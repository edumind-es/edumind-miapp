#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Push delivery for provider observability alerts."""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime
from typing import Any

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models import SystemConfig
from app.services.provider_observability_service import safe_bool, safe_int

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in constrained envs
    Redis = None

logger = logging.getLogger(__name__)

_LAST_SENT_ALERT_TS: dict[str, float] = {}
_LAST_SENT_LOCK = threading.Lock()
_REDIS_CLIENT: Redis | None = None
_REDIS_LOCK = threading.Lock()
_CIRCUIT_OPEN_UNTIL_TS = 0.0
_CIRCUIT_FAILURE_COUNT = 0

PUSH_CONFIG_KEYS = {
    "enabled": "observability.push.enabled",
    "webhook_url": "observability.push.webhook_url",
    "cooldown_seconds": "observability.push.cooldown_seconds",
}


class PushCircuitOpenError(RuntimeError):
    """Raised when provider alert push circuit breaker is open."""


def load_push_config(session: Session) -> dict[str, Any]:
    rows = session.exec(
        select(SystemConfig).where(SystemConfig.key.like("observability.push.%"))
    ).all()
    raw = {row.key: row.value for row in rows}

    return {
        "enabled": safe_bool(raw.get(PUSH_CONFIG_KEYS["enabled"]), False),
        "webhook_url": (raw.get(PUSH_CONFIG_KEYS["webhook_url"]) or "").strip(),
        "cooldown_seconds": max(30, safe_int(raw.get(PUSH_CONFIG_KEYS["cooldown_seconds"]), 300)),
    }


def _alert_fingerprint(alert: dict[str, Any]) -> str:
    provider = (alert.get("provider") or "global").strip().lower()
    code = (alert.get("code") or "unknown").strip().lower()
    level = (alert.get("level") or "warning").strip().lower()
    return f"{provider}:{code}:{level}"


def _redis_prefix() -> str:
    return f"{settings.BACKGROUND_TASK_REDIS_PREFIX}:provider-alerts"


def _cooldown_key(fingerprint: str) -> str:
    return f"{_redis_prefix()}:cooldown:{fingerprint}"


def _circuit_open_key() -> str:
    return f"{_redis_prefix()}:circuit:open"


def _circuit_failure_key() -> str:
    return f"{_redis_prefix()}:circuit:failures"


def _get_redis_client() -> Redis | None:
    global _REDIS_CLIENT
    if not settings.REDIS_URL or Redis is None:
        return None

    with _REDIS_LOCK:
        if _REDIS_CLIENT is not None:
            return _REDIS_CLIENT

    try:
        client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        client.ping()
    except Exception:
        return None

    with _REDIS_LOCK:
        _REDIS_CLIENT = client
    return client


def _is_within_cooldown(fingerprint: str, cooldown_seconds: int, now_ts: float) -> bool:
    client = _get_redis_client()
    if client is not None:
        try:
            created = client.set(_cooldown_key(fingerprint), str(int(now_ts)), ex=cooldown_seconds, nx=True)
            return not bool(created)
        except Exception:
            pass

    with _LAST_SENT_LOCK:
        last_ts = _LAST_SENT_ALERT_TS.get(fingerprint, 0.0)
        if now_ts - last_ts < cooldown_seconds:
            return True
        _LAST_SENT_ALERT_TS[fingerprint] = now_ts
    return False


def _clear_last_sent(fingerprint: str):
    client = _get_redis_client()
    if client is not None:
        try:
            client.delete(_cooldown_key(fingerprint))
            return
        except Exception:
            pass

    with _LAST_SENT_LOCK:
        _LAST_SENT_ALERT_TS.pop(fingerprint, None)


def _is_circuit_open(now_ts: float) -> bool:
    client = _get_redis_client()
    if client is not None:
        try:
            return client.exists(_circuit_open_key()) == 1
        except Exception:
            pass

    with _LAST_SENT_LOCK:
        return now_ts < _CIRCUIT_OPEN_UNTIL_TS


def _register_push_success():
    global _CIRCUIT_FAILURE_COUNT, _CIRCUIT_OPEN_UNTIL_TS
    client = _get_redis_client()
    if client is not None:
        try:
            client.delete(_circuit_open_key(), _circuit_failure_key())
            return
        except Exception:
            pass

    with _LAST_SENT_LOCK:
        _CIRCUIT_FAILURE_COUNT = 0
        _CIRCUIT_OPEN_UNTIL_TS = 0.0


def _register_push_failure(now_ts: float):
    global _CIRCUIT_FAILURE_COUNT, _CIRCUIT_OPEN_UNTIL_TS
    threshold = settings.BACKGROUND_TASK_CIRCUIT_BREAKER_THRESHOLD
    open_seconds = settings.BACKGROUND_TASK_CIRCUIT_BREAKER_OPEN_SECONDS
    client = _get_redis_client()
    if client is not None:
        try:
            failures = int(client.incr(_circuit_failure_key()))
            client.expire(_circuit_failure_key(), open_seconds)
            if failures >= threshold:
                client.set(_circuit_open_key(), "1", ex=open_seconds)
            return
        except Exception:
            pass

    with _LAST_SENT_LOCK:
        _CIRCUIT_FAILURE_COUNT += 1
        if _CIRCUIT_FAILURE_COUNT >= threshold:
            _CIRCUIT_OPEN_UNTIL_TS = now_ts + open_seconds


def dispatch_provider_alerts(
    session: Session,
    alerts: list[dict[str, Any]],
    *,
    raise_on_failure: bool = False,
) -> int:
    """
    Dispatch provider alerts to a configured webhook channel.

    Delivery is best-effort by default; when `raise_on_failure=True` the caller can
    treat failures as retryable background task errors.
    """
    if not alerts:
        return 0

    cfg = load_push_config(session)
    if not cfg["enabled"] or not cfg["webhook_url"]:
        return 0

    now_ts = time.time()
    if _is_circuit_open(now_ts):
        exc = PushCircuitOpenError("Provider alert push circuit breaker is open.")
        if raise_on_failure:
            raise exc
        logger.warning("%s", exc)
        return 0

    cooldown_seconds = int(cfg["cooldown_seconds"])
    deliver_queue: list[tuple[str, dict[str, Any]]] = []

    for alert in alerts:
        fingerprint = _alert_fingerprint(alert)
        if _is_within_cooldown(fingerprint, cooldown_seconds, now_ts):
            continue
        deliver_queue.append((fingerprint, alert))

    if not deliver_queue:
        return 0

    sent = 0
    webhook_url = str(cfg["webhook_url"])
    timeout = httpx.Timeout(
        settings.BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS,
        connect=min(settings.BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS, 3.0),
    )
    with httpx.Client(timeout=timeout) as client:
        for fingerprint, alert in deliver_queue:
            payload = {
                "source": "edumind-miapp",
                "event": "provider_alert",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "alert": alert,
            }
            try:
                response = client.post(webhook_url, json=payload)
                response.raise_for_status()
                sent += 1
            except Exception as exc:
                logger.warning("Failed to push provider alert %s: %s", fingerprint, exc)
                _clear_last_sent(fingerprint)
                _register_push_failure(now_ts)
                if raise_on_failure:
                    raise

    if sent:
        _register_push_success()

    return sent
