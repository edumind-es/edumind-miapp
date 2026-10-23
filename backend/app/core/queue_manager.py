#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.config import settings

try:
    from redis import Redis
except Exception:  # pragma: no cover - optional dependency in constrained envs
    Redis = None


class QueueStatus(BaseModel):
    is_active: bool
    position: int
    estimated_wait_seconds: int
    message: str
    backend: Optional[str] = None


class QueueManager:
    def __init__(self):
        self._lock = threading.Lock()
        self.active_sessions: dict[str, float] = {}

        self._redis_client: Redis | None = None
        self._redis_state: str = "not_initialized"
        self._redis_last_error: str | None = None

    @property
    def max_concurrent_users(self) -> int:
        return settings.QUEUE_MAX_CONCURRENT_USERS

    @property
    def timeout_seconds(self) -> int:
        return settings.QUEUE_TIMEOUT_SECONDS

    def _queue_backend(self) -> str:
        return settings.QUEUE_BACKEND.lower().strip()

    def _redis_key_sessions(self) -> str:
        return f"{settings.QUEUE_REDIS_PREFIX}:sessions"

    def _redis_key_lock(self) -> str:
        return f"{settings.QUEUE_REDIS_PREFIX}:lock"

    def _use_redis(self) -> bool:
        backend = self._queue_backend()
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

    def _redis_lock(self, client: Redis):
        return client.lock(
            self._redis_key_lock(),
            timeout=max(self.timeout_seconds, 5),
            blocking_timeout=1.0,
        )

    def _cleanup_expired_sessions(self, now_ts: float):
        cutoff_ts = now_ts - self.timeout_seconds
        client = self._get_redis_client()
        if client is not None:
            try:
                client.zremrangebyscore(self._redis_key_sessions(), "-inf", cutoff_ts)
            except Exception as exc:  # pragma: no cover
                self._record_redis_error(exc)
            return

        with self._lock:
            self._cleanup_expired_sessions_memory(now_ts)

    def _cleanup_expired_sessions_memory(self, now_ts: float):
        cutoff_ts = now_ts - self.timeout_seconds
        self.active_sessions = {
            uid: ts for uid, ts in self.active_sessions.items() if ts > cutoff_ts
        }

    def _active_count(self) -> int:
        client = self._get_redis_client()
        if client is not None:
            try:
                return int(client.zcard(self._redis_key_sessions()))
            except Exception as exc:  # pragma: no cover
                self._record_redis_error(exc)
                return 0
        with self._lock:
            return len(self.active_sessions)

    def _has_session(self, user_id: str) -> bool:
        client = self._get_redis_client()
        if client is not None:
            try:
                return client.zscore(self._redis_key_sessions(), user_id) is not None
            except Exception as exc:  # pragma: no cover
                self._record_redis_error(exc)
                return False
        with self._lock:
            return user_id in self.active_sessions

    def _touch_session(self, user_id: str, now_ts: float):
        client = self._get_redis_client()
        if client is not None:
            try:
                client.zadd(self._redis_key_sessions(), {user_id: now_ts})
            except Exception as exc:  # pragma: no cover
                self._record_redis_error(exc)
            return
        with self._lock:
            self.active_sessions[user_id] = now_ts

    def _current_backend(self) -> str:
        return "redis" if self._get_redis_client() is not None else "memory"

    def _busy_status(self, active_count: int) -> QueueStatus:
        return QueueStatus(
            is_active=False,
            position=max(1, active_count - self.max_concurrent_users + 1),
            estimated_wait_seconds=60,
            message=f"Server Busy ({self.max_concurrent_users}/{self.max_concurrent_users}). Retrying...",
            backend=self._current_backend(),
        )

    def _active_status(self, message: str) -> QueueStatus:
        return QueueStatus(
            is_active=True,
            position=0,
            estimated_wait_seconds=0,
            message=message,
            backend=self._current_backend(),
        )

    def _peek_status_memory(self, user_id: str, now_ts: float) -> QueueStatus:
        with self._lock:
            self._cleanup_expired_sessions_memory(now_ts)
            if user_id in self.active_sessions:
                return self._active_status("Active Session")

            active_count = len(self.active_sessions)
            if active_count < self.max_concurrent_users:
                return self._active_status(
                    f"Slot Available ({active_count}/{self.max_concurrent_users})"
                )
            return self._busy_status(active_count)

    def _reserve_slot_memory(self, user_id: str, now_ts: float) -> QueueStatus:
        with self._lock:
            self._cleanup_expired_sessions_memory(now_ts)
            if user_id in self.active_sessions:
                self.active_sessions[user_id] = now_ts
                return self._active_status("Active Session")

            active_count = len(self.active_sessions)
            if active_count < self.max_concurrent_users:
                self.active_sessions[user_id] = now_ts
                return self._active_status(
                    f"Connected ({active_count + 1}/{self.max_concurrent_users})"
                )
            return self._busy_status(active_count)

    def _peek_status_redis(self, client: Redis, user_id: str, now_ts: float) -> QueueStatus:
        cutoff_ts = now_ts - self.timeout_seconds
        try:
            with self._redis_lock(client):
                client.zremrangebyscore(self._redis_key_sessions(), "-inf", cutoff_ts)
                if client.zscore(self._redis_key_sessions(), user_id) is not None:
                    return self._active_status("Active Session")

                active_count = int(client.zcard(self._redis_key_sessions()))
                if active_count < self.max_concurrent_users:
                    return self._active_status(
                        f"Slot Available ({active_count}/{self.max_concurrent_users})"
                    )
                return self._busy_status(active_count)
        except Exception as exc:  # pragma: no cover - network dependent
            self._record_redis_error(exc)
            return self._peek_status_memory(user_id, now_ts)

    def _reserve_slot_redis(self, client: Redis, user_id: str, now_ts: float) -> QueueStatus:
        cutoff_ts = now_ts - self.timeout_seconds
        try:
            with self._redis_lock(client):
                client.zremrangebyscore(self._redis_key_sessions(), "-inf", cutoff_ts)
                if client.zscore(self._redis_key_sessions(), user_id) is not None:
                    client.zadd(self._redis_key_sessions(), {user_id: now_ts})
                    return self._active_status("Active Session")

                active_count = int(client.zcard(self._redis_key_sessions()))
                if active_count < self.max_concurrent_users:
                    client.zadd(self._redis_key_sessions(), {user_id: now_ts})
                    return self._active_status(
                        f"Connected ({active_count + 1}/{self.max_concurrent_users})"
                    )
                return self._busy_status(active_count)
        except Exception as exc:  # pragma: no cover - network dependent
            self._record_redis_error(exc)
            return self._reserve_slot_memory(user_id, now_ts)

    async def peek_status(self, user_id: str, is_admin: bool) -> QueueStatus:
        """
        Read-only queue check.
        Does NOT reserve a slot for users that are not already active.
        """
        now_ts = time.time()
        self._cleanup_expired_sessions(now_ts)

        if is_admin:
            return self._active_status("Admin Access: Unrestricted")

        client = self._get_redis_client()
        if client is not None:
            return self._peek_status_redis(client, user_id, now_ts)
        return self._peek_status_memory(user_id, now_ts)

    async def reserve_slot(self, user_id: str, is_admin: bool) -> QueueStatus:
        """
        Reserve or refresh an active slot.
        Call this ONLY when a generation/chat request is about to run.
        """
        now_ts = time.time()
        if is_admin:
            return self._active_status("Admin Access: Unrestricted")

        client = self._get_redis_client()
        if client is not None:
            return self._reserve_slot_redis(client, user_id, now_ts)
        return self._reserve_slot_memory(user_id, now_ts)

    async def check_status(self, user_id: str, is_admin: bool) -> QueueStatus:
        """Backward-compatible alias for reserving slots."""
        return await self.reserve_slot(user_id, is_admin)

    async def get_runtime_status(self) -> dict:
        now_iso = datetime.utcnow().isoformat()
        self._cleanup_expired_sessions(time.time())
        return {
            "backend": self._current_backend(),
            "configured_backend": self._queue_backend(),
            "active_sessions": self._active_count(),
            "max_concurrent_users": self.max_concurrent_users,
            "timeout_seconds": self.timeout_seconds,
            "redis_state": self._redis_state,
            "redis_last_error": self._redis_last_error,
            "timestamp": now_iso,
        }


queue_manager = QueueManager()
