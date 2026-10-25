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

import pytest
from sqlmodel import Session

from app.api.v1 import auth as auth_module
from app.api.v1 import generators as generators_module
from app.core import config
from app.db import engine
from app.models import User, UserRole
from app.services.curriculum_matrix_service import CurriculumMatrixService

MATRIZ = "galicia/primaria/educacion-fisica/5o"


def _usuario() -> dict:
    tag = uuid4().hex[:8]
    with Session(engine) as session:
        user = User(username=f"fb_{tag}", email=f"fb_{tag}@example.com", role=UserRole.DOCENTE, hashed_password="x")
        session.add(user)
        session.commit()
        username = user.username
    return {"Authorization": f"Bearer {auth_module.create_access_token({'sub': username})}"}


def _falso_stream(respuestas: dict[str, list[str]], llamadas: list[str]):
    async def _stream_chat(provider, messages, api_key, model=None, generator_type=None, json_mode=False):
        llamadas.append(provider)
        for chunk in respuestas.get(provider, ["Error: motor sin respuesta"]):
            yield chunk

    return _stream_chat


def test_validate_cited_codes_distingue_codigos_reales_de_inventados():
    if not CurriculumMatrixService.get_matriz(MATRIZ):
        pytest.skip("matriz no disponible en el índice")
    resultado = CurriculumMatrixService.validate_cited_codes(
        MATRIZ, "Se trabaja el criterio CE1.1 y el saber B1.2; también se cita ce9.9 y B7.4."
    )
    assert "CE1.1" in resultado["citados"] and "B1.2" in resultado["citados"]
    assert resultado["desconocidos"] == ["CE9.9", "B7.4"]


def test_core_caido_cae_a_gemma_para_usuarios_registrados(client, api_v1_prefix, monkeypatch):
    llamadas: list[str] = []
    monkeypatch.setattr(config.settings, "MANAGED_FALLBACK_TO_OLLAMA", "registered")
    monkeypatch.setattr(config.settings, "AI_TRANSIENT_RETRIES", 0)
    monkeypatch.setattr(
        generators_module.AIService,
        "stream_chat",
        staticmethod(_falso_stream({"edumind": ["Error: Servicio EDUmind no disponible temporalmente."], "ollama": ["Sesión ", "generada."]}, llamadas)),
    )
    resp = client.post(
        f"{api_v1_prefix}/generators/session",
        json={"tema": "Saltos", "curso": "5º Primaria", "descripcion": "Sesión de saltos con combas", "provider": "edumind"},
        headers=_usuario(),
    )
    assert resp.status_code == 200, resp.text
    assert "Gemma 4" in resp.text
    assert "Sesión generada." in resp.text
    assert llamadas == ["edumind", "ollama"]


def test_core_caido_sin_sesion_no_usa_gemma(client, api_v1_prefix, monkeypatch):
    llamadas: list[str] = []
    monkeypatch.setattr(config.settings, "MANAGED_FALLBACK_TO_OLLAMA", "registered")
    monkeypatch.setattr(config.settings, "AI_TRANSIENT_RETRIES", 0)
    monkeypatch.setattr(
        generators_module.AIService,
        "stream_chat",
        staticmethod(_falso_stream({"edumind": ["Error: Servicio EDUmind no disponible temporalmente."], "ollama": ["no debería verse"]}, llamadas)),
    )
    resp = client.post(
        f"{api_v1_prefix}/generators/session",
        json={"tema": "Saltos", "curso": "5º Primaria", "descripcion": "Sesión de saltos con combas", "provider": "edumind"},
    )
    assert resp.status_code == 200
    assert resp.text.lstrip().startswith("Error:")
    assert llamadas == ["edumind"]


def test_salida_con_codigos_inventados_recibe_aviso_de_revision(client, api_v1_prefix, monkeypatch):
    if not CurriculumMatrixService.get_matriz(MATRIZ):
        pytest.skip("matriz no disponible en el índice")
    monkeypatch.setattr(
        generators_module.AIService,
        "stream_chat",
        staticmethod(_falso_stream({"edumind": ["Trabajamos CE1.1 y también CE8.7 en la sesión."]}, [])),
    )
    resp = client.post(
        f"{api_v1_prefix}/generators/session",
        json={
            "tema": "Saltos", "curso": "5º Primaria", "descripcion": "Sesión de saltos con combas",
            "provider": "edumind", "matriz_curricular": {"id": MATRIZ, "criterios": ["CE1.1"]},
        },
        headers=_usuario(),
    )
    assert resp.status_code == 200, resp.text
    assert "[Revisión curricular]" in resp.text
    assert "CE8.7" in resp.text
