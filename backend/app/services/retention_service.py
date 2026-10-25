#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Retención de datos: purga de registros de actividad antiguos.

Los registros de `ActivityLog` guardan IP enmascarada y detalles de uso. Pasado
el plazo de retención dejan de servir para operar el servicio y se eliminan.
"""

import logging
from datetime import datetime, timedelta

from sqlmodel import Session, delete

from app.core.config import settings
from app.models import ActivityLog

logger = logging.getLogger(__name__)


def purge_activity_log(session: Session, retention_days: int | None = None) -> int:
    """Elimina los registros de actividad más antiguos que el plazo de retención.

    Devuelve el número de filas borradas. Con un plazo de 0 o negativo no borra nada.
    """
    days = settings.ACTIVITY_LOG_RETENTION_DAYS if retention_days is None else retention_days
    if days <= 0:
        return 0

    cutoff = datetime.utcnow() - timedelta(days=days)
    result = session.exec(delete(ActivityLog).where(ActivityLog.created_at < cutoff))
    session.commit()
    deleted = int(result.rowcount or 0)
    if deleted:
        logger.info("Retención: eliminados %s registros de actividad anteriores a %s", deleted, cutoff.date())
    return deleted
