#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Un único limitador de peticiones para toda la API.

Antes había siete instancias en memoria, una por módulo y multiplicadas por el
número de workers, así que los límites reales eran varias veces los declarados.
Con Redis configurado los contadores se comparten entre procesos; sin él se usa
memoria y se avisa en el arranque.
"""

import logging

from slowapi import Limiter

from app.core.config import settings
from app.core.security import get_client_ip

logger = logging.getLogger(__name__)


def _storage_uri() -> str:
    uri = settings.RATE_LIMIT_STORAGE_URI or settings.REDIS_URL
    if uri:
        return uri
    if settings.RUNTIME_ENV != "development":
        logger.warning("Limitador de peticiones en memoria: los límites se aplican por proceso, no de forma global")
    return "memory://"


limiter = Limiter(
    key_func=get_client_ip,
    default_limits=["200/minute"],
    storage_uri=_storage_uri(),
    in_memory_fallback_enabled=True,
)
