#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Revocación de sesiones: lista de `jti` anulados hasta que el token caduque.

Con Redis la revocación vale para todos los procesos; sin él se guarda en
memoria del proceso (suficiente para un solo worker y para desarrollo).
"""

import logging
import threading
import time
from typing import Dict, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class TokenDenylist:
    def __init__(self) -> None:
        self._memory: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._redis = None
        self._redis_checked = False

    def _get_redis(self):
        if self._redis_checked:
            return self._redis
        self._redis_checked = True
        if not settings.REDIS_URL:
            return None
        try:
            import redis

            client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
            client.ping()
            self._redis = client
        except Exception as exc:  # pragma: no cover - depende del entorno
            logger.warning("Revocación de tokens en memoria: Redis no disponible (%s)", exc)
            self._redis = None
        return self._redis

    def _key(self, jti: str) -> str:
        return f"{settings.TOKEN_DENYLIST_REDIS_PREFIX}:{jti}"

    def revoke(self, jti: Optional[str], expires_at: Optional[float]) -> None:
        """Anula el token hasta su caducidad (segundos desde época)."""
        if not jti:
            return
        now = time.time()
        ttl = int((expires_at or now + 3600) - now)
        if ttl <= 0:
            return
        client = self._get_redis()
        if client is not None:
            try:
                client.set(self._key(jti), "1", ex=ttl)
                return
            except Exception as exc:  # pragma: no cover
                logger.warning("No se pudo anotar la revocación en Redis (%s); se usa memoria", exc)
        with self._lock:
            self._prune_locked(now)
            self._memory[jti] = now + ttl

    def is_revoked(self, jti: Optional[str]) -> bool:
        if not jti:
            return False
        client = self._get_redis()
        if client is not None:
            try:
                return bool(client.exists(self._key(jti)))
            except Exception:  # pragma: no cover
                pass
        with self._lock:
            expires = self._memory.get(jti)
            if expires is None:
                return False
            if expires <= time.time():
                del self._memory[jti]
                return False
            return True

    def _prune_locked(self, now: float) -> None:
        if len(self._memory) < 1000:
            return
        for key in [k for k, exp in self._memory.items() if exp <= now]:
            del self._memory[key]


token_denylist = TokenDenylist()
