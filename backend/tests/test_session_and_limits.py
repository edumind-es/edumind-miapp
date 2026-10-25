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

from jose import jwt
from sqlmodel import Session

from app.api.v1 import auth as auth_module
from app.core.config import settings
from app.db import engine
from app.models import User, UserRole
from main import app


def _usuario(role: UserRole = UserRole.DOCENTE) -> tuple[int, str]:
    tag = uuid4().hex[:8]
    with Session(engine) as session:
        user = User(username=f"ses_{tag}", email=f"ses_{tag}@example.com", role=role, hashed_password="x")
        session.add(user)
        session.commit()
        session.refresh(user)
        return user.id, user.username


# --- Sesiones -----------------------------------------------------------------

def test_token_lleva_jti_y_caduca_en_horas(client):
    _, username = _usuario()
    token = auth_module.create_access_token({"sub": username})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["jti"]
    assert payload["exp"] - payload["iat"] <= 60 * 60 * 24


def test_logout_revoca_el_token(client, api_v1_prefix):
    _, username = _usuario()
    headers = {"Authorization": f"Bearer {auth_module.create_access_token({'sub': username})}"}
    assert client.get(f"{api_v1_prefix}/auth/me", headers=headers).status_code == 200

    assert client.post(f"{api_v1_prefix}/auth/logout", headers=headers).status_code == 200

    assert client.get(f"{api_v1_prefix}/auth/me", headers=headers).status_code == 401


def test_next_path_rechaza_barra_invertida():
    assert auth_module._sanitize_next_path("/\\evil.com") == "/dashboard"
    assert auth_module._sanitize_next_path("/dashboard\\@evil.com") == "/dashboard"
    assert auth_module._sanitize_next_path("/tools/session?x=1") == "/tools/session?x=1"


# --- Exportación ----------------------------------------------------------------

def test_export_rechaza_contenido_excesivo(client, api_v1_prefix):
    resp = client.post(f"{api_v1_prefix}/export/txt", json={"content": "a" * 200_001})
    assert resp.status_code == 422


def test_export_sanea_nombre_de_fichero(client, api_v1_prefix):
    resp = client.post(
        f"{api_v1_prefix}/export/txt",
        json={"content": "hola", "filename": '../..\\x"; rm -rf\r\nSet-Cookie: a=b'},
    )
    assert resp.status_code == 200
    disposicion = resp.headers["content-disposition"]
    assert "\r" not in disposicion and "\n" not in disposicion and ".." not in disposicion
    assert disposicion.startswith('attachment; filename="')


def test_export_html_escapa_el_contenido(client, api_v1_prefix):
    resp = client.post(
        f"{api_v1_prefix}/export/html",
        json={"content": "<script>alert(1)</script>", "title": "<img src=x onerror=1>"},
    )
    assert resp.status_code == 200
    assert "<script>" not in resp.text
    assert "&lt;script&gt;" in resp.text
    assert "onerror=1>" not in resp.text


# --- Subida ---------------------------------------------------------------------

def test_subida_rechaza_tipo_falso(client, api_v1_prefix):
    admin_id, _ = _usuario(UserRole.ADMIN)
    with Session(engine) as session:
        admin = session.get(User, admin_id)
        snapshot = User(
            id=admin.id, username=admin.username, email=admin.email, role=admin.role,
            hashed_password=admin.hashed_password, is_active=admin.is_active, created_at=admin.created_at,
        )
    app.dependency_overrides[auth_module.require_admin_from_vpn] = lambda: snapshot
    try:
        resp = client.post(
            f"{api_v1_prefix}/dataset/upload",
            files={"file": ("falso.pdf", b"esto no es un pdf", "application/pdf")},
        )
    finally:
        app.dependency_overrides.pop(auth_module.require_admin_from_vpn, None)
    assert resp.status_code == 400
    assert "extensi" in resp.json()["detail"]
