#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Supresión de datos personales: borrado real de clases y de cuentas completas.

Las claves foráneas no tienen `ondelete` en el esquema actual, así que la cascada
se hace aquí, en orden, dentro de una sola transacción.
"""

import logging
from typing import Dict

from sqlmodel import Session, delete, select, update

from app.models import (
    ActivityLog,
    ApiKey,
    AppFeedback,
    ClassSchedule,
    Document,
    GeneratedResource,
    PlannerEntry,
    ResourceLink,
    StudentCode,
    TeacherClass,
    TeacherProfile,
    TrainingItem,
    TrainingJob,
    User,
)

logger = logging.getLogger(__name__)


def _rowcount(result) -> int:
    return int(getattr(result, "rowcount", 0) or 0)


def delete_class_data(session: Session, teacher_class: TeacherClass, *, commit: bool = True) -> Dict[str, int]:
    """Borra una clase y todo lo que cuelga de ella (horario, códigos de alumnado, vínculos, planificador)."""
    class_id = teacher_class.id
    counts = {
        "planner_entries": _rowcount(session.exec(delete(PlannerEntry).where(PlannerEntry.class_id == class_id))),
        "resource_links": _rowcount(session.exec(delete(ResourceLink).where(ResourceLink.class_id == class_id))),
        "student_codes": _rowcount(session.exec(delete(StudentCode).where(StudentCode.class_id == class_id))),
        "schedules": _rowcount(session.exec(delete(ClassSchedule).where(ClassSchedule.class_id == class_id))),
    }
    session.delete(teacher_class)
    if commit:
        session.commit()
    return counts


def delete_user_account(session: Session, user: User) -> Dict[str, int]:
    """Elimina la cuenta y sus datos personales.

    - Se borran: clases y sus datos, recursos generados, planificador, claves API,
      feedback, registros de actividad y aportaciones al dataset aún no verificadas.
    - Se desvinculan (quedan sin autor): aportaciones ya verificadas, documentos
      subidos y trabajos de entrenamiento, que forman parte del fondo común.
    """
    user_id = user.id
    counts: Dict[str, int] = {}

    classes = session.exec(select(TeacherClass).where(TeacherClass.user_id == user_id)).all()
    counts["classes"] = len(classes)
    for teacher_class in classes:
        delete_class_data(session, teacher_class, commit=False)

    # Vínculos y entradas que apuntan a recursos del usuario desde clases ajenas (no debería haber, pero por si acaso)
    resource_ids = select(GeneratedResource.id).where(GeneratedResource.user_id == user_id)
    session.exec(delete(ResourceLink).where(ResourceLink.resource_id.in_(resource_ids)))
    session.exec(
        update(PlannerEntry).where(PlannerEntry.resource_id.in_(resource_ids)).values(resource_id=None)
    )
    counts["planner_entries"] = _rowcount(session.exec(delete(PlannerEntry).where(PlannerEntry.user_id == user_id)))
    counts["resources"] = _rowcount(session.exec(delete(GeneratedResource).where(GeneratedResource.user_id == user_id)))
    counts["profile"] = _rowcount(session.exec(delete(TeacherProfile).where(TeacherProfile.user_id == user_id)))
    counts["api_keys"] = _rowcount(session.exec(delete(ApiKey).where(ApiKey.user_id == user_id)))
    counts["feedback"] = _rowcount(session.exec(delete(AppFeedback).where(AppFeedback.user_id == user_id)))
    counts["activity_logs"] = _rowcount(session.exec(delete(ActivityLog).where(ActivityLog.user_id == user_id)))
    counts["training_items_deleted"] = _rowcount(
        session.exec(
            delete(TrainingItem).where(TrainingItem.creator_id == user_id, TrainingItem.is_verified == False)  # noqa: E712
        )
    )
    counts["training_items_anonymized"] = _rowcount(
        session.exec(update(TrainingItem).where(TrainingItem.creator_id == user_id).values(creator_id=None))
    )
    session.exec(update(TrainingItem).where(TrainingItem.verified_by_id == user_id).values(verified_by_id=None))
    session.exec(update(Document).where(Document.uploader_id == user_id).values(uploader_id=None))
    session.exec(update(TrainingJob).where(TrainingJob.created_by_id == user_id).values(created_by_id=None))

    session.delete(user)
    session.commit()
    logger.info("Cuenta eliminada (id=%s): %s", user_id, counts)
    return counts
