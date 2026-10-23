#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#

"""Admission control for open-access managed providers."""

from __future__ import annotations

import hashlib
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Optional
from uuid import uuid4

from fastapi import Request
from sqlmodel import Session, select

from app.core.anonymous_session import get_anonymous_subject
from app.core.config import settings
from app.core.queue_manager import queue_manager
from app.core.security import get_client_ip
from app.db import engine
from app.models import SystemConfig, User, UserRole
from app.services.metrics_service import metrics

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in constrained envs
    Redis = None


@dataclass
class AdmissionDecision:
    allowed: bool
    reason: str
    message: str = ""
    status_code: int = 200
    retry_after: int = 0
    challenge_required: bool = False


class AdmissionControlService:
    def __init__(self):
        self._lock = threading.RLock()
        self._anon_windows: dict[str, Deque[float]] = defaultdict(deque)
        self._anon_cooldowns: dict[str, float] = {}
        self._denials_by_ip: dict[str, Deque[float]] = defaultdict(deque)

        self._config_cache_expiry = 0.0
        self._config_cache: dict[str, str] = {}
        self._redis_client: Redis | None = None
        self._redis_state: str = "not_initialized"
        self._redis_last_error: str | None = None

    def _is_admin(self, current_user: Optional[User]) -> bool:
        return bool(current_user and current_user.role == UserRole.ADMIN)

    def _is_authenticated(self, current_user: Optional[User]) -> bool:
        return bool(current_user)

    def _parse_bool(self, value: Optional[str], fallback: bool) -> bool:
        if value is None:
            return fallback
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        return fallback

    def _parse_int(self, value: Optional[str], fallback: int) -> int:
        if value is None:
            return fallback
        try:
            return int(value.strip())
        except Exception:
            return fallback

    def _parse_float(self, value: Optional[str], fallback: float) -> float:
        if value is None:
            return fallback
        try:
            return float(value.strip())
        except Exception:
            return fallback

    def _load_runtime_config(self) -> dict[str, str]:
        now = time.time()
        with self._lock:
            if now <= self._config_cache_expiry:
                return dict(self._config_cache)

        loaded: dict[str, str] = {}
        try:
            with Session(engine) as session:
                rows = session.exec(
                    select(SystemConfig).where(SystemConfig.key.like("admission.%"))
                ).all()
                loaded = {row.key: row.value for row in rows}
        except Exception:
            loaded = {}

        with self._lock:
            self._config_cache = loaded
            self._config_cache_expiry = now + settings.ADMISSION_CONFIG_CACHE_SECONDS
            return dict(self._config_cache)

    def _runtime_bool(self, key: str, default: bool) -> bool:
        cfg = self._load_runtime_config()
        return self._parse_bool(cfg.get(key), default)

    def _runtime_int(self, key: str, default: int) -> int:
        cfg = self._load_runtime_config()
        return self._parse_int(cfg.get(key), default)

    def _runtime_float(self, key: str, default: float) -> float:
        cfg = self._load_runtime_config()
        return self._parse_float(cfg.get(key), default)

    def managed_public_enabled(self) -> bool:
        return self._runtime_bool(
            "admission.managed_public_enabled",
            settings.ADMISSION_MANAGED_PUBLIC_ENABLED,
        )

    def _load_shed_enabled(self) -> bool:
        return self._runtime_bool(
            "admission.load_shed_enabled",
            settings.ADMISSION_LOAD_SHED_ENABLED,
        )

    def _load_shed_threshold(self) -> float:
        return self._runtime_float(
            "admission.load_shed_queue_utilization",
            settings.ADMISSION_LOAD_SHED_QUEUE_UTILIZATION,
        )

    def _load_shed_min_active(self) -> int:
        return self._runtime_int(
            "admission.load_shed_min_active",
            settings.ADMISSION_LOAD_SHED_MIN_ACTIVE,
        )

    def _anon_window_seconds(self) -> int:
        return self._runtime_int(
            "admission.anon_window_seconds",
            settings.ADMISSION_ANON_WINDOW_SECONDS,
        )

    def _anon_max_requests(self) -> int:
        return self._runtime_int(
            "admission.anon_max_requests",
            settings.ADMISSION_ANON_MAX_REQUESTS,
        )

    def _anon_cooldown_seconds(self) -> int:
        return self._runtime_int(
            "admission.anon_cooldown_seconds",
            settings.ADMISSION_ANON_COOLDOWN_SECONDS,
        )

    def _anon_max_input_chars(self) -> int:
        return self._runtime_int(
            "admission.anon_max_input_chars",
            settings.ADMISSION_ANON_MAX_INPUT_CHARS,
        )

    def _abuse_window_seconds(self) -> int:
        return self._runtime_int(
            "admission.abuse_window_seconds",
            settings.ADMISSION_ABUSE_WINDOW_SECONDS,
        )

    def _abuse_challenge_threshold(self) -> int:
        return self._runtime_int(
            "admission.abuse_challenge_threshold",
            settings.ADMISSION_ABUSE_CHALLENGE_THRESHOLD,
        )

    def _cleanup_deque(self, target: Deque[float], now_ts: float, window_seconds: int):
        cutoff = now_ts - window_seconds
        while target and target[0] < cutoff:
            target.popleft()

    def _admission_backend(self) -> str:
        return settings.ADMISSION_BACKEND.lower().strip()

    def _use_redis(self) -> bool:
        backend = self._admission_backend()
        if backend == "memory":
            return False
        if backend == "redis":
            return True
        return bool(settings.REDIS_URL)

    def _get_redis_client(self) -> Redis | None:
        if not self._use_redis():
            self._redis_state = "disabled"
            return None

        if Redis is None:
            self._redis_state = "unavailable"
            self._redis_last_error = "redis package not installed"
            return None

        with self._lock:
            if self._redis_client is not None:
                return self._redis_client

        try:
            client = Redis.from_url(settings.REDIS_URL or "", decode_responses=True)
            client.ping()
            with self._lock:
                self._redis_client = client
                self._redis_state = "connected"
                self._redis_last_error = None
            return client
        except Exception as exc:  # pragma: no cover - external service dependent
            with self._lock:
                self._redis_client = None
                self._redis_state = "error"
                self._redis_last_error = str(exc)
            return None

    def _record_redis_error(self, exc: Exception):
        with self._lock:
            self._redis_state = "error"
            self._redis_last_error = str(exc)

    def _redis_key_fragment(self, value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _redis_key_actor_window(self, actor: str) -> str:
        return f"{settings.ADMISSION_REDIS_PREFIX}:anon_window:{self._redis_key_fragment(actor)}"

    def _redis_key_actor_cooldown(self, actor: str) -> str:
        return f"{settings.ADMISSION_REDIS_PREFIX}:anon_cooldown:{self._redis_key_fragment(actor)}"

    def _redis_key_denials(self, client_ip: str) -> str:
        return f"{settings.ADMISSION_REDIS_PREFIX}:denials:{self._redis_key_fragment(client_ip)}"

    def _redis_key_lock(self, scope: str, value: str) -> str:
        return f"{settings.ADMISSION_REDIS_PREFIX}:lock:{scope}:{self._redis_key_fragment(value)}"

    def _redis_lock(self, client: Redis, scope: str, value: str):
        return client.lock(
            self._redis_key_lock(scope, value),
            timeout=max(self._anon_cooldown_seconds(), 5),
            blocking_timeout=1.0,
        )

    def _anonymous_actor(self, request: Request) -> str:
        subject = get_anonymous_subject(request)
        if subject:
            return f"anon:{subject}"
        return f"anon-ip:{get_client_ip(request)}"

    def _record_denial(self, client_ip: str) -> bool:
        client = self._get_redis_client()
        if client is not None:
            return self._record_denial_redis(client, client_ip)
        return self._record_denial_memory(client_ip)

    def _record_denial_memory(self, client_ip: str) -> bool:
        now = time.time()
        window = self._abuse_window_seconds()
        with self._lock:
            events = self._denials_by_ip[client_ip]
            self._cleanup_deque(events, now, window)
            events.append(now)
            return len(events) >= self._abuse_challenge_threshold()

    def _record_denial_redis(self, client: Redis, client_ip: str) -> bool:
        now = time.time()
        window = self._abuse_window_seconds()
        denial_key = self._redis_key_denials(client_ip)
        try:
            with self._redis_lock(client, "denials", client_ip):
                client.zremrangebyscore(denial_key, "-inf", now - window)
                client.zadd(denial_key, {f"{now}:{uuid4().hex}": now})
                client.expire(denial_key, max(window, 1))
                return int(client.zcard(denial_key)) >= self._abuse_challenge_threshold()
        except Exception as exc:  # pragma: no cover - external service dependent
            self._record_redis_error(exc)
            return self._record_denial_memory(client_ip)

    def _check_anonymous_limits(
        self,
        *,
        actor: str,
    ) -> tuple[bool, str | None, int]:
        client = self._get_redis_client()
        if client is not None:
            return self._check_anonymous_limits_redis(client=client, actor=actor)
        return self._check_anonymous_limits_memory(actor=actor)

    def _check_anonymous_limits_memory(self, *, actor: str) -> tuple[bool, str | None, int]:
        now = time.time()
        with self._lock:
            cooldown_until = self._anon_cooldowns.get(actor, 0.0)
            if cooldown_until > now:
                retry_after = max(int(cooldown_until - now), 1)
                return False, "cooldown_active", retry_after

            window = self._anon_window_seconds()
            max_requests = self._anon_max_requests()
            events = self._anon_windows[actor]
            self._cleanup_deque(events, now, window)
            if len(events) >= max_requests:
                cooldown = self._anon_cooldown_seconds()
                self._anon_cooldowns[actor] = now + cooldown
                return False, "quota_exceeded", cooldown

            events.append(now)
            return True, None, 0

    def _check_anonymous_limits_redis(
        self,
        *,
        client: Redis,
        actor: str,
    ) -> tuple[bool, str | None, int]:
        now = time.time()
        window = self._anon_window_seconds()
        max_requests = self._anon_max_requests()
        cooldown = self._anon_cooldown_seconds()
        window_key = self._redis_key_actor_window(actor)
        cooldown_key = self._redis_key_actor_cooldown(actor)

        try:
            with self._redis_lock(client, "anon", actor):
                ttl = int(client.ttl(cooldown_key))
                if ttl > 0:
                    return False, "cooldown_active", ttl

                client.zremrangebyscore(window_key, "-inf", now - window)
                if int(client.zcard(window_key)) >= max_requests:
                    client.setex(cooldown_key, cooldown, str(now + cooldown))
                    client.expire(window_key, max(window, cooldown))
                    return False, "quota_exceeded", cooldown

                client.zadd(window_key, {f"{now}:{uuid4().hex}": now})
                client.expire(window_key, max(window, 1))
                return True, None, 0
        except Exception as exc:  # pragma: no cover - external service dependent
            self._record_redis_error(exc)
            return self._check_anonymous_limits_memory(actor=actor)

    def _allow(self, provider: str, reason: str) -> AdmissionDecision:
        metrics.record_admission(provider=provider, decision="allow", reason=reason)
        return AdmissionDecision(allowed=True, reason=reason)

    def _deny(
        self,
        *,
        provider: str,
        reason: str,
        status_code: int,
        message: str,
        retry_after: int = 0,
        challenge_required: bool = False,
    ) -> AdmissionDecision:
        metrics.record_admission(provider=provider, decision="deny", reason=reason)
        return AdmissionDecision(
            allowed=False,
            reason=reason,
            status_code=status_code,
            message=message,
            retry_after=retry_after,
            challenge_required=challenge_required,
        )

    async def evaluate_managed_provider_access(
        self,
        *,
        request: Request,
        current_user: Optional[User],
        provider: str,
        input_chars: int,
    ) -> AdmissionDecision:
        if self._is_admin(current_user):
            return self._allow(provider, "admin_bypass")

        if not self.managed_public_enabled():
            challenge_required = self._record_denial(get_client_ip(request))
            return self._deny(
                provider=provider,
                reason="managed_provider_disabled",
                status_code=503,
                message="Modo sostenibilidad activo. Motor gestionado temporalmente deshabilitado.",
                retry_after=60,
                challenge_required=challenge_required,
            )

        if self._load_shed_enabled():
            queue_runtime = await queue_manager.get_runtime_status()
            active = int(queue_runtime.get("active_sessions", 0))
            max_users = max(int(queue_runtime.get("max_concurrent_users", 1)), 1)
            utilization = active / max_users
            if active >= self._load_shed_min_active() and utilization >= self._load_shed_threshold():
                challenge_required = self._record_denial(get_client_ip(request))
                return self._deny(
                    provider=provider,
                    reason="load_shed",
                    status_code=503,
                    message="Capacidad temporal agotada. Usa WebGPU local o proveedor BYOK.",
                    retry_after=45,
                    challenge_required=challenge_required,
                )

        if self._is_authenticated(current_user):
            return self._allow(provider, "authenticated_user")

        max_input = self._anon_max_input_chars()
        if input_chars > max_input:
            challenge_required = self._record_denial(get_client_ip(request))
            return self._deny(
                provider=provider,
                reason="payload_too_large",
                status_code=413,
                message=(
                    f"Petición demasiado grande para modo anónimo ({input_chars} chars). "
                    f"Límite actual: {max_input}."
                ),
                challenge_required=challenge_required,
            )

        actor = self._anonymous_actor(request)
        allowed, denial_reason, retry_after = self._check_anonymous_limits(actor=actor)
        if not allowed:
            challenge_required = self._record_denial(get_client_ip(request))
            if denial_reason == "cooldown_active":
                return self._deny(
                    provider=provider,
                    reason="cooldown_active",
                    status_code=429,
                    message="Límite temporal alcanzado para modo anónimo. Inténtalo más tarde.",
                    retry_after=retry_after,
                    challenge_required=challenge_required,
                )
            return self._deny(
                provider=provider,
                reason="quota_exceeded",
                status_code=429,
                message=(
                    "Límite de uso anónimo alcanzado en esta ventana. "
                    "Puedes usar WebGPU local o BYOK mientras se libera cuota."
                ),
                retry_after=retry_after,
                challenge_required=challenge_required,
            )

        return self._allow(provider, "anon_quota_ok")

    def get_runtime_policy_snapshot(self) -> dict:
        return {
            "managed_public_enabled": self.managed_public_enabled(),
            "load_shed_enabled": self._load_shed_enabled(),
            "load_shed_queue_utilization": self._load_shed_threshold(),
            "load_shed_min_active": self._load_shed_min_active(),
            "anon_window_seconds": self._anon_window_seconds(),
            "anon_max_requests": self._anon_max_requests(),
            "anon_cooldown_seconds": self._anon_cooldown_seconds(),
            "anon_max_input_chars": self._anon_max_input_chars(),
            "abuse_window_seconds": self._abuse_window_seconds(),
            "abuse_challenge_threshold": self._abuse_challenge_threshold(),
        }


admission_control = AdmissionControlService()
