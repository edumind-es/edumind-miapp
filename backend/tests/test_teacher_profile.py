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

from sqlmodel import Session, select

from app.api.v1 import auth as auth_module
from app.db import engine
from app.models import TeacherProfile, User, UserRole
from app.services.account_service import delete_user_account


def _usuario() -> tuple[int, dict]:
    tag = uuid4().hex[:8]
    with Session(engine) as session:
        user = User(username=f"perfil_{tag}", email=f"perfil_{tag}@example.com", role=UserRole.DOCENTE, hashed_password="x")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id, {"Authorization": f"Bearer {auth_module.create_access_token({'sub': user.username})}"}


def test_perfil_vacio_crear_actualizar_y_minimizar(client, api_v1_prefix):
    user_id, headers = _usuario()
    assert client.get(f"{api_v1_prefix}/profile/me", headers=headers).json()["curso"] is None

    resp = client.put(
        f"{api_v1_prefix}/profile/me",
        json={
            "comunidad_key": "galicia", "etapa_key": "primaria", "area_key": "educacion-fisica",
            "curso": "5.º de Primaria", "matriz_id": "galicia/primaria/educacion-fisica/5o",
            "metodologia_slider": 70, "tipo_agrupamiento": "Parejas",
            "contexto_aula": "Centro rural; contacto tutor@colegio.es",
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    datos = resp.json()
    assert datos["matriz_id"] == "galicia/primaria/educacion-fisica/5o"
    assert "tutor@colegio.es" not in datos["contexto_aula"]

    resp = client.put(f"{api_v1_prefix}/profile/me", json={"curso": "6.º de Primaria"}, headers=headers)
    assert resp.json()["curso"] == "6.º de Primaria"
    with Session(engine) as session:
        assert len(session.exec(select(TeacherProfile).where(TeacherProfile.user_id == user_id)).all()) == 1

    assert client.put(f"{api_v1_prefix}/profile/me", json={"matriz_id": "../etc"}, headers=headers).status_code == 422
    assert client.put(f"{api_v1_prefix}/profile/me", json={"metodologia_slider": 140}, headers=headers).status_code == 422


def test_perfil_requiere_sesion_y_se_borra_con_la_cuenta(client, api_v1_prefix):
    assert client.get(f"{api_v1_prefix}/profile/me").status_code == 401
    user_id, headers = _usuario()
    client.put(f"{api_v1_prefix}/profile/me", json={"curso": "4.º"}, headers=headers)
    with Session(engine) as session:
        delete_user_account(session, session.get(User, user_id))
        assert session.exec(select(TeacherProfile).where(TeacherProfile.user_id == user_id)).first() is None
