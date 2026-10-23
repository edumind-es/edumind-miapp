#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from app.db import engine
from app.models import (
    ClassSchedule,
    GeneratedResource,
    PlannerEntry,
    ResourceLink,
    ResourceType,
    StudentCode,
    TeacherClass,
    User,
    UserRole,
)
from main import app
import app.api.v1.classroom as classroom_api
import app.api.v1.planner as planner_api
import app.api.v1.resources as resources_api


def _create_user(session: Session, *, role: UserRole, prefix: str) -> User:
    suffix = uuid4().hex[:10]
    user = User(
        username=f"{prefix}_{suffix}",
        email=f"{prefix}_{suffix}@example.com",
        role=role,
        hashed_password="test-password",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_class(
    session: Session,
    *,
    user_id: int,
    course: str = "3º ESO",
    group: str = "A",
    subject: str = "Educación Física",
    academic_year: str = "2025-2026",
    student_count: int = 3,
    color: str = "#3B82F6",
) -> TeacherClass:
    teacher_class = TeacherClass(
        user_id=user_id,
        name=f"{course} {group}",
        course=course,
        group=group,
        subject=subject,
        academic_year=academic_year,
        student_count=student_count,
        color=color,
    )
    session.add(teacher_class)
    session.commit()
    session.refresh(teacher_class)

    for number in range(1, student_count + 1):
        session.add(
            StudentCode(
                class_id=teacher_class.id,
                code=f"A{number:02d}",
                number=number,
            )
        )
    session.commit()
    return teacher_class


def _create_resource(
    session: Session,
    *,
    user_id: int,
    title: str = "Recurso de prueba",
    resource_type: ResourceType = ResourceType.SESSION,
) -> GeneratedResource:
    resource = GeneratedResource(
        user_id=user_id,
        resource_type=resource_type,
        title=title,
        content="Contenido de ejemplo suficientemente largo para el recurso.",
    )
    session.add(resource)
    session.commit()
    session.refresh(resource)
    return resource


@pytest.fixture
def teacher_premium_context():
    with Session(engine) as session:
        teacher = _create_user(session, role=UserRole.TEACHER_PREMIUM, prefix="teacher")
        other_teacher = _create_user(session, role=UserRole.TEACHER_PREMIUM, prefix="other_teacher")
        teacher_id = teacher.id
        other_teacher_id = other_teacher.id
        teacher_username = teacher.username
        teacher_email = teacher.email
        teacher_role = teacher.role
        teacher_hashed_password = teacher.hashed_password
        teacher_is_active = teacher.is_active
        teacher_created_at = teacher.created_at

    teacher_snapshot = User(
        id=teacher_id,
        username=teacher_username,
        email=teacher_email,
        role=teacher_role,
        hashed_password=teacher_hashed_password,
        is_active=teacher_is_active,
        created_at=teacher_created_at,
    )

    def _override():
        return teacher_snapshot

    app.dependency_overrides[classroom_api.require_teacher_premium] = _override
    app.dependency_overrides[planner_api.require_teacher_premium] = _override
    app.dependency_overrides[resources_api.require_teacher_premium] = _override

    yield {"teacher_id": teacher_id, "other_teacher_id": other_teacher_id}

    app.dependency_overrides.pop(classroom_api.require_teacher_premium, None)
    app.dependency_overrides.pop(planner_api.require_teacher_premium, None)
    app.dependency_overrides.pop(resources_api.require_teacher_premium, None)

    user_ids = {teacher_id, other_teacher_id}

    with Session(engine) as session:
        class_ids = {
            teacher_class.id
            for teacher_class in session.exec(select(TeacherClass)).all()
            if teacher_class.user_id in user_ids
        }
        resource_ids = {
            resource.id
            for resource in session.exec(select(GeneratedResource)).all()
            if resource.user_id in user_ids
        }

        for entry in session.exec(select(PlannerEntry)).all():
            if entry.user_id in user_ids:
                session.delete(entry)

        for link in session.exec(select(ResourceLink)).all():
            if link.class_id in class_ids or link.resource_id in resource_ids:
                session.delete(link)

        for schedule in session.exec(select(ClassSchedule)).all():
            if schedule.class_id in class_ids:
                session.delete(schedule)

        for student in session.exec(select(StudentCode)).all():
            if student.class_id in class_ids:
                session.delete(student)

        for resource in session.exec(select(GeneratedResource)).all():
            if resource.user_id in user_ids:
                session.delete(resource)

        for teacher_class in session.exec(select(TeacherClass)).all():
            if teacher_class.user_id in user_ids:
                session.delete(teacher_class)

        for user in session.exec(select(User)).all():
            if user.id in user_ids:
                session.delete(user)

        session.commit()


def test_classroom_create_rejects_invalid_academic_year(client, api_v1_prefix, teacher_premium_context):
    response = client.post(
        f"{api_v1_prefix}/classroom/classes",
        json={
            "course": "3º ESO",
            "group": "A",
            "subject": "Educación Física",
            "academic_year": "2025/2026",
            "student_count": 25,
        },
    )

    assert response.status_code == 422


def test_classroom_update_rejects_reduction_when_removed_students_have_notes(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id, student_count=3)
        teacher_class_id = teacher_class.id
        student = session.exec(
            select(StudentCode).where(
                StudentCode.class_id == teacher_class_id,
                StudentCode.number == 3,
            )
        ).one()
        student.notes = "Observación importante"
        session.add(student)
        session.commit()

    response = client.put(
        f"{api_v1_prefix}/classroom/classes/{teacher_class_id}",
        json={"student_count": 2},
    )

    assert response.status_code == 409

    with Session(engine) as session:
        refreshed_class = session.get(TeacherClass, teacher_class_id)
        students = session.exec(
            select(StudentCode).where(StudentCode.class_id == teacher_class_id)
        ).all()
        assert refreshed_class.student_count == 3
        assert len(students) == 3


def test_classroom_schedule_rejects_overlapping_slot(client, api_v1_prefix, teacher_premium_context):
    teacher_id = teacher_premium_context["teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id)
        teacher_class_id = teacher_class.id
        session.add(
            ClassSchedule(
                class_id=teacher_class_id,
                day_of_week=1,
                start_time="09:00",
                end_time="10:00",
                room="Gimnasio",
            )
        )
        session.commit()

    response = client.post(
        f"{api_v1_prefix}/classroom/classes/{teacher_class_id}/schedule",
        json={
            "day_of_week": 1,
            "start_time": "09:30",
            "end_time": "10:15",
            "room": "Pista",
        },
    )

    assert response.status_code == 409


def test_resources_save_rejects_foreign_class_and_does_not_persist_resource(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    other_teacher_id = teacher_premium_context["other_teacher_id"]
    with Session(engine) as session:
        foreign_class = _create_class(session, user_id=other_teacher_id)
        foreign_class_id = foreign_class.id

    title = f"Recurso bloqueado {uuid4().hex[:8]}"
    response = client.post(
        f"{api_v1_prefix}/resources/",
        json={
            "resource_type": "session",
            "title": title,
            "content": "Contenido válido para guardar como recurso.",
            "link_to_class_id": foreign_class_id,
        },
    )

    assert response.status_code == 404

    with Session(engine) as session:
        saved = session.exec(
            select(GeneratedResource).where(
                GeneratedResource.user_id == teacher_id,
                GeneratedResource.title == title,
            )
        ).first()
        assert saved is None


def test_planner_create_rejects_foreign_resource_reference(client, api_v1_prefix, teacher_premium_context):
    teacher_id = teacher_premium_context["teacher_id"]
    other_teacher_id = teacher_premium_context["other_teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id)
        teacher_class_id = teacher_class.id
        foreign_resource = _create_resource(session, user_id=other_teacher_id, title="Recurso ajeno")
        foreign_resource_id = foreign_resource.id

    response = client.post(
        f"{api_v1_prefix}/planner/entries",
        json={
            "class_id": teacher_class_id,
            "entry_date": "2026-04-06",
            "start_time": "10:00",
            "end_time": "10:55",
            "title": "Sesión con recurso ajeno",
            "resource_id": foreign_resource_id,
        },
    )

    assert response.status_code == 404

    with Session(engine) as session:
        entries = session.exec(
            select(PlannerEntry).where(
                PlannerEntry.user_id == teacher_id,
                PlannerEntry.class_id == teacher_class_id,
            )
        ).all()
        assert entries == []


def test_planner_update_rejects_foreign_resource_and_preserves_existing_entry(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    other_teacher_id = teacher_premium_context["other_teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id)
        teacher_class_id = teacher_class.id
        own_resource = _create_resource(session, user_id=teacher_id, title="Recurso propio")
        own_resource_id = own_resource.id
        foreign_resource = _create_resource(session, user_id=other_teacher_id, title="Recurso ajeno")
        foreign_resource_id = foreign_resource.id
        entry = PlannerEntry(
            user_id=teacher_id,
            class_id=teacher_class_id,
            entry_date=date(2026, 4, 7),
            start_time="11:00",
            end_time="11:55",
            title="Entrada existente",
            resource_id=own_resource_id,
            color=teacher_class.color,
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        entry_id = entry.id

    response = client.put(
        f"{api_v1_prefix}/planner/entries/{entry_id}",
        json={"resource_id": foreign_resource_id},
    )

    assert response.status_code == 404

    with Session(engine) as session:
        persisted = session.get(PlannerEntry, entry_id)
        assert persisted is not None
        assert persisted.resource_id == own_resource_id


def test_planner_generate_sequence_preview_returns_structured_sessions(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(
            session,
            user_id=teacher_id,
            course="5º Primaria",
            group="A",
            subject="Educacion Fisica",
        )
        teacher_class_id = teacher_class.id
        session.add(
            ClassSchedule(
                class_id=teacher_class_id,
                day_of_week=0,
                start_time="09:00",
                end_time="09:55",
                room="Pabellon",
            )
        )
        session.add(
            ClassSchedule(
                class_id=teacher_class_id,
                day_of_week=2,
                start_time="10:00",
                end_time="10:55",
                room="Patio",
            )
        )
        session.commit()

    response = client.post(
        f"{api_v1_prefix}/planner/entries/generate-sequence",
        json={
            "class_id": teacher_class_id,
            "start_date": "2026-04-06",
            "session_count": 3,
            "sequence_title": "Coordinacion y juego cooperativo",
            "area": "Educacion Fisica",
            "stage": "Educación Primaria",
            "criteria": [
                "Participa de forma activa en juegos cooperativos.",
                "Aplica habilidades motrices en situaciones variadas.",
            ],
            "contents": [
                "Juegos cooperativos de persecución",
                "Coordinación dinámica general",
                "Calentamiento y vuelta a la calma",
            ],
            "methodology_slider": 72,
            "methodology_notes": "Aprendizaje cooperativo con estaciones.",
            "additional_proposals": "Cerrar con reto final en pequeño grupo.",
            "dua_diversity": "Modelado visual, parejas de apoyo y elección de materiales.",
            "web_resources": ["https://ejemplo.edu/juegos"],
            "edumind_resource_refs": ["https://edumind.es/recursos/cooperativos"],
            "linked_resource_ids": [],
            "edumind_apps": ["edumind_quiz"],
            "external_resource_refs": ["Video inicial", "Tarjetas visuales en PDF"],
            "persist": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["persisted"] is False
    assert payload["schedule_based"] is True
    assert len(payload["sessions"]) == 3
    assert payload["sessions"][0]["entry_date"] == "2026-04-06"
    assert payload["sessions"][1]["entry_date"] == "2026-04-08"
    assert payload["sessions"][2]["entry_date"] == "2026-04-13"
    assert "Coordinacion y juego cooperativo" in payload["planning_summary"]


def test_planner_generate_sequence_persist_creates_entries_and_planning_resource(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id, course="6º Primaria", group="B")
        teacher_class_id = teacher_class.id
        linked_resource = _create_resource(
            session,
            user_id=teacher_id,
            title="Infografia de apoyo",
            resource_type=ResourceType.OTHER,
        )
        linked_resource_id = linked_resource.id
        session.add(
            ClassSchedule(
                class_id=teacher_class_id,
                day_of_week=1,
                start_time="11:00",
                end_time="11:55",
                room="Gimnasio",
            )
        )
        session.commit()

    response = client.post(
        f"{api_v1_prefix}/planner/entries/generate-sequence",
        json={
            "class_id": teacher_class_id,
            "start_date": "2026-04-07",
            "session_count": 2,
            "sequence_title": "Resistencia saludable",
            "area": "Educacion Fisica",
            "stage": "Educación Primaria",
            "criteria": ["Regula el esfuerzo en tareas motrices."],
            "contents": ["Circuitos de resistencia", "Autoregulación del esfuerzo"],
            "methodology_slider": 58,
            "methodology_notes": "Circuitos por estaciones y feedback rápido.",
            "additional_proposals": "Añadir autoevaluación breve al final.",
            "dua_diversity": "Opciones de intensidad y apoyos visuales.",
            "web_resources": [],
            "edumind_resource_refs": [],
            "linked_resource_ids": [linked_resource_id],
            "edumind_apps": ["edumind_motion", "edumind_quiz"],
            "external_resource_refs": ["PDF de circuito"],
            "persist": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["persisted"] is True
    assert len(payload["created_entries"]) == 2
    assert payload["planning_resource_id"] is not None

    with Session(engine) as session:
        planning_resource = session.get(GeneratedResource, payload["planning_resource_id"])
        assert planning_resource is not None
        assert planning_resource.resource_type == ResourceType.PLANNING
        linked_entries = session.exec(
            select(PlannerEntry).where(PlannerEntry.resource_id == planning_resource.id)
        ).all()
        assert len(linked_entries) == 2
        resource_link = session.exec(
            select(ResourceLink).where(
                ResourceLink.resource_id == planning_resource.id,
                ResourceLink.class_id == teacher_class_id,
            )
        ).first()
        assert resource_link is not None


def test_planner_generate_sequence_rejects_foreign_linked_resource(
    client, api_v1_prefix, teacher_premium_context
):
    teacher_id = teacher_premium_context["teacher_id"]
    other_teacher_id = teacher_premium_context["other_teacher_id"]
    with Session(engine) as session:
        teacher_class = _create_class(session, user_id=teacher_id)
        teacher_class_id = teacher_class.id
        foreign_resource = _create_resource(session, user_id=other_teacher_id, title="Recurso ajeno planner")
        foreign_resource_id = foreign_resource.id
        session.add(
            ClassSchedule(
                class_id=teacher_class_id,
                day_of_week=0,
                start_time="08:30",
                end_time="09:25",
            )
        )
        session.commit()

    response = client.post(
        f"{api_v1_prefix}/planner/entries/generate-sequence",
        json={
            "class_id": teacher_class_id,
            "start_date": "2026-04-06",
            "session_count": 1,
            "sequence_title": "Secuencia bloqueada",
            "area": "Educación Física",
            "criteria": ["Criterio válido"],
            "contents": ["Contenido válido"],
            "methodology_slider": 50,
            "linked_resource_ids": [foreign_resource_id],
            "web_resources": [],
            "edumind_resource_refs": [],
            "edumind_apps": [],
            "external_resource_refs": [],
            "persist": False,
        },
    )

    assert response.status_code == 404
