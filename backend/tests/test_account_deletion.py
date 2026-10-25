#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from datetime import date
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.v1 import auth as auth_module
from app.db import engine
from app.models import (
    ActivityLog,
    ApiKey,
    GeneratedResource,
    PlannerEntry,
    ResourceType,
    StudentCode,
    TeacherClass,
    TrainingItem,
    TrainingItemSource,
    User,
    UserRole,
)
from app.services.account_service import delete_user_account
from main import app

# Nota: los tests reciben `client` aunque no lo usen porque arrancar la app crea las tablas (en CI la BD empieza vacía).


def _crear_usuario_con_datos(session: Session, *, role: UserRole = UserRole.TEACHER_PREMIUM) -> User:
    tag = uuid4().hex[:8]
    user = User(
        username=f"borrar_{tag}",
        email=f"borrar_{tag}@example.com",
        role=role,
        hashed_password=auth_module.get_password_hash("Secreta123!"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    clase = TeacherClass(user_id=user.id, name="6º A", course="6º", group="A", subject="EF", academic_year="2026-2027")
    session.add(clase)
    session.commit()
    session.refresh(clase)
    session.add(StudentCode(class_id=clase.id, code="A01", number=1, notes="nota privada"))
    recurso = GeneratedResource(user_id=user.id, resource_type=ResourceType.SESSION, title="Sesión", content="x")
    session.add(recurso)
    session.commit()
    session.refresh(recurso)
    session.add(
        PlannerEntry(
            user_id=user.id, class_id=clase.id, entry_date=date.today(), start_time="09:00", end_time="09:55",
            title="Sesión 1", resource_id=recurso.id,
        )
    )
    session.add(ApiKey(user_id=user.id, engine="chatgpt", encrypted_key="cifrada"))
    session.add(ActivityLog(user_id=user.id, action="login", details=f"User {user.username} logged in"))
    session.add(TrainingItem(instruction="p", output="r", source=TrainingItemSource.MANUAL, creator_id=user.id))
    session.add(
        TrainingItem(instruction="p2", output="r2", source=TrainingItemSource.MANUAL, creator_id=user.id, is_verified=True)
    )
    session.commit()
    return user


def _contar_rastros(session: Session, user_id: int) -> dict:
    return {
        "classes": len(session.exec(select(TeacherClass).where(TeacherClass.user_id == user_id)).all()),
        "resources": len(session.exec(select(GeneratedResource).where(GeneratedResource.user_id == user_id)).all()),
        "planner": len(session.exec(select(PlannerEntry).where(PlannerEntry.user_id == user_id)).all()),
        "api_keys": len(session.exec(select(ApiKey).where(ApiKey.user_id == user_id)).all()),
        "logs": len(session.exec(select(ActivityLog).where(ActivityLog.user_id == user_id)).all()),
        "items": len(session.exec(select(TrainingItem).where(TrainingItem.creator_id == user_id)).all()),
    }


def test_servicio_borra_la_cuenta_y_todos_sus_datos(client):
    with Session(engine) as session:
        user = _crear_usuario_con_datos(session)
        user_id = user.id
        assert _contar_rastros(session, user_id)["classes"] == 1
        clase_id = session.exec(select(TeacherClass.id).where(TeacherClass.user_id == user_id)).one()

        counts = delete_user_account(session, user)

        assert counts["classes"] == 1
        assert counts["training_items_deleted"] == 1
        assert counts["training_items_anonymized"] == 1
        assert session.get(User, user_id) is None
        assert all(valor == 0 for valor in _contar_rastros(session, user_id).values())
        # El código de alumnado y su nota privada desaparecen con la clase
        assert session.exec(select(StudentCode).where(StudentCode.class_id == clase_id)).first() is None


def test_delete_me_exige_confirmacion_y_cierra_sesion(client, api_v1_prefix):
    with Session(engine) as session:
        user = _crear_usuario_con_datos(session)
        username, user_id = user.username, user.id

    with TestClient(app) as cliente:
        # Token en cabecera: la cookie de sesión es `secure` y el cliente de pruebas va por http.
        token = auth_module.create_access_token({"sub": username})
        cabeceras = {"Authorization": f"Bearer {token}"}

        mal = cliente.request("DELETE", f"{api_v1_prefix}/auth/me", json={"confirm_username": "otro"}, headers=cabeceras)
        assert mal.status_code == 400

        bien = cliente.request("DELETE", f"{api_v1_prefix}/auth/me", json={"confirm_username": username}, headers=cabeceras)
        assert bien.status_code == 200
        assert bien.json()["message"] == "Cuenta eliminada"

        assert cliente.get(f"{api_v1_prefix}/auth/me", headers=cabeceras).status_code == 401

    with Session(engine) as session:
        assert session.get(User, user_id) is None


def test_delete_me_protege_la_unica_cuenta_admin(client, api_v1_prefix):
    with Session(engine) as session:
        # Desactivamos temporalmente a los demás admins para simular que este es el único
        otros = session.exec(select(User).where(User.role == UserRole.ADMIN, User.is_active == True)).all()  # noqa: E712
        ids_otros = [u.id for u in otros]
        for u in otros:
            u.is_active = False
            session.add(u)
        session.commit()
        admin = _crear_usuario_con_datos(session, role=UserRole.ADMIN)
        username, admin_id = admin.username, admin.id

    try:
        with TestClient(app) as cliente:
            token = auth_module.create_access_token({"sub": username})
            resp = cliente.request(
                "DELETE", f"{api_v1_prefix}/auth/me",
                json={"confirm_username": username}, headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 409
    finally:
        with Session(engine) as session:
            for uid in ids_otros:
                u = session.get(User, uid)
                if u:
                    u.is_active = True
                    session.add(u)
            session.commit()
            admin = session.get(User, admin_id)
            if admin:
                delete_user_account(session, admin)
