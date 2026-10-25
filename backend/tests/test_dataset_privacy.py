#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from uuid import uuid4

from sqlmodel import Session

from app.api.v1 import auth as auth_module
from app.db import engine
from main import app
from app.models import TrainingItem, User, UserRole
from app.services.dataset_privacy import scrub_personal_data


def _usuario(role: UserRole = UserRole.DOCENTE) -> tuple[int, dict]:
    tag = uuid4().hex[:8]
    with Session(engine) as session:
        user = User(username=f"ds_{tag}", email=f"ds_{tag}@example.com", role=role, hashed_password="x")
        session.add(user)
        session.commit()
        session.refresh(user)
        user_id = user.id
        username = user.username
    token = auth_module.create_access_token({"sub": username})
    return user_id, {"Authorization": f"Bearer {token}"}


def test_scrub_sustituye_datos_reconocibles():
    texto = "Alumno con DNI 12345678Z, madre en ana.perez@gmail.com y móvil 612 34 56 78. NIE X1234567L."
    limpio, n = scrub_personal_data(texto)
    assert "12345678Z" not in limpio
    assert "ana.perez@gmail.com" not in limpio
    assert "612 34 56 78" not in limpio
    assert "X1234567L" not in limpio
    assert n == 4
    assert "[correo]" in limpio and "[dni]" in limpio and "[teléfono]" in limpio and "[nie]" in limpio


def test_scrub_respeta_texto_normal():
    texto = "Sesión de 55 minutos con 24 alumnos; criterio 3.2 de 6º de Primaria (curso 2026-2027)."
    assert scrub_personal_data(texto) == (texto, 0)


def test_feedback_sin_consentimiento_se_rechaza(client, api_v1_prefix):
    _, headers = _usuario()
    resp = client.post(
        f"{api_v1_prefix}/feedback",
        json={"instruction": "Pregunta larga", "output": "Respuesta larga", "quality_score": 5},
        headers=headers,
    )
    assert resp.status_code == 422


def test_feedback_con_consentimiento_guarda_minimizado(client, api_v1_prefix):
    _, headers = _usuario()
    resp = client.post(
        f"{api_v1_prefix}/feedback",
        json={
            "instruction": "Redacta aviso para familias: contacto tutor@colegio.es",
            "output": "Estimadas familias, llamad al 698765432.",
            "quality_score": 5,
            "consent": True,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    item_id = resp.json()["id"]
    with Session(engine) as session:
        item = session.get(TrainingItem, item_id)
        assert "tutor@colegio.es" not in item.instruction
        assert "698765432" not in item.output
        session.delete(item)
        session.commit()


def test_contribucion_sin_consentimiento_se_rechaza(client, api_v1_prefix):
    resp = client.post(
        f"{api_v1_prefix}/generators/contribute",
        json={"output": "x" * 200, "tool": "session"},
    )
    assert resp.status_code == 422


def test_subida_de_ficheros_solo_admin(client, api_v1_prefix):
    _, headers = _usuario(UserRole.DOCENTE)
    resp = client.post(
        f"{api_v1_prefix}/dataset/upload",
        files={"file": ("notas.md", b"# hola", "text/markdown")},
        headers=headers,
    )
    assert resp.status_code == 403


def test_verificar_desvincula_al_autor(client, api_v1_prefix):
    autor_id, _ = _usuario(UserRole.DOCENTE)
    admin_id, _ = _usuario(UserRole.ADMIN)
    with Session(engine) as session:
        item = TrainingItem(instruction="p", output="r", source="manual", creator_id=autor_id)
        session.add(item)
        session.commit()
        session.refresh(item)
        item_id = item.id
        admin = session.get(User, admin_id)
        admin_snapshot = User(
            id=admin.id, username=admin.username, email=admin.email, role=admin.role,
            hashed_password=admin.hashed_password, is_active=admin.is_active, created_at=admin.created_at,
        )

    # El cliente de pruebas no viene de red local: se sustituye la guarda admin+VPN como en test_background_tasks.
    app.dependency_overrides[auth_module.require_admin_from_vpn] = lambda: admin_snapshot
    try:
        resp = client.post(f"{api_v1_prefix}/dataset/items/{item_id}/verify")
    finally:
        app.dependency_overrides.pop(auth_module.require_admin_from_vpn, None)
    assert resp.status_code == 200, resp.text
    with Session(engine) as session:
        item = session.get(TrainingItem, item_id)
        assert item.is_verified is True
        assert item.creator_id is None
        session.delete(item)
        session.commit()
