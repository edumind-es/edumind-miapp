#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

import asyncio
import threading
import time

from starlette.requests import Request

from app.core.config import settings
from app.core.queue_manager import QueueManager
from app.services.admission_control_service import AdmissionControlService


class _FakeRedisLock:
    def __init__(self, lock: threading.RLock):
        self._lock = lock

    def __enter__(self):
        self._lock.acquire()
        return self

    def __exit__(self, exc_type, exc, tb):
        self._lock.release()
        return False


class FakeRedis:
    def __init__(self):
        self._sets: dict[str, dict[str, float]] = {}
        self._strings: dict[str, str] = {}
        self._expiry: dict[str, float] = {}
        self._locks: dict[str, threading.RLock] = {}

    def ping(self):
        return True

    def lock(self, name: str, timeout: int | None = None, blocking_timeout: float | None = None):
        del timeout, blocking_timeout
        lock = self._locks.setdefault(name, threading.RLock())
        return _FakeRedisLock(lock)

    def _purge_expired(self, key: str):
        expires_at = self._expiry.get(key)
        if expires_at is not None and expires_at <= time.time():
            self._expiry.pop(key, None)
            self._strings.pop(key, None)
            self._sets.pop(key, None)

    def zremrangebyscore(self, key: str, min_score, max_score):
        del min_score
        self._purge_expired(key)
        target = self._sets.get(key, {})
        cutoff = float(max_score)
        for member, score in list(target.items()):
            if score <= cutoff:
                target.pop(member, None)

    def zcard(self, key: str) -> int:
        self._purge_expired(key)
        return len(self._sets.get(key, {}))

    def zscore(self, key: str, member: str):
        self._purge_expired(key)
        return self._sets.get(key, {}).get(member)

    def zadd(self, key: str, mapping: dict[str, float]):
        self._purge_expired(key)
        target = self._sets.setdefault(key, {})
        target.update(mapping)

    def expire(self, key: str, seconds: int):
        self._purge_expired(key)
        if key in self._sets or key in self._strings:
            self._expiry[key] = time.time() + seconds
            return True
        return False

    def setex(self, key: str, seconds: int, value: str):
        self._strings[key] = value
        self._expiry[key] = time.time() + seconds

    def ttl(self, key: str) -> int:
        self._purge_expired(key)
        if key not in self._sets and key not in self._strings:
            return -2
        expires_at = self._expiry.get(key)
        if expires_at is None:
            return -1
        return max(int(expires_at - time.time()), 1)


def _request_with_external_ip(ip: str = "198.51.100.77") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/chat/completions",
            "headers": [(b"x-real-ip", ip.encode("utf-8"))],
            "client": ("127.0.0.1", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
            "query_string": b"",
        }
    )


def test_queue_manager_redis_reservation_is_shared_across_instances(monkeypatch):
    fake_redis = FakeRedis()
    first_manager = QueueManager()
    second_manager = QueueManager()

    monkeypatch.setattr(settings, "QUEUE_MAX_CONCURRENT_USERS", 1)
    monkeypatch.setattr(first_manager, "_get_redis_client", lambda: fake_redis)
    monkeypatch.setattr(second_manager, "_get_redis_client", lambda: fake_redis)

    first = asyncio.run(first_manager.reserve_slot("user_1", False))
    second = asyncio.run(second_manager.reserve_slot("user_2", False))
    runtime = asyncio.run(first_manager.get_runtime_status())

    assert first.is_active is True
    assert second.is_active is False
    assert runtime["backend"] == "redis"
    assert runtime["active_sessions"] == 1


def test_admission_control_redis_quota_is_shared_across_instances(monkeypatch):
    fake_redis = FakeRedis()
    first_service = AdmissionControlService()
    second_service = AdmissionControlService()

    for service in (first_service, second_service):
        monkeypatch.setattr(service, "_get_redis_client", lambda fake_redis=fake_redis: fake_redis)
        monkeypatch.setattr(service, "managed_public_enabled", lambda: True)
        monkeypatch.setattr(service, "_load_shed_enabled", lambda: False)
        monkeypatch.setattr(service, "_anon_window_seconds", lambda: 300)
        monkeypatch.setattr(service, "_anon_max_requests", lambda: 1)
        monkeypatch.setattr(service, "_anon_cooldown_seconds", lambda: 60)
        monkeypatch.setattr(service, "_abuse_window_seconds", lambda: 600)
        monkeypatch.setattr(service, "_abuse_challenge_threshold", lambda: 2)

    request = _request_with_external_ip()

    first = asyncio.run(
        first_service.evaluate_managed_provider_access(
            request=request,
            current_user=None,
            provider="edumind",
            input_chars=120,
        )
    )
    second = asyncio.run(
        second_service.evaluate_managed_provider_access(
            request=request,
            current_user=None,
            provider="edumind",
            input_chars=120,
        )
    )

    assert first.allowed is True
    assert second.allowed is False
    assert second.reason == "quota_exceeded"
    assert second.status_code == 429
