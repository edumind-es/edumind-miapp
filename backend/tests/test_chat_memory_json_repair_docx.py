#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

import json

from app.api.v1 import generators as generators_module
from app.services.chat_memory import trim_chat_history


def test_trim_chat_history_conserva_los_ultimos_turnos_y_el_ultimo_mensaje():
    mensajes = [{"role": "system", "content": "S"}]
    for i in range(20):
        mensajes.append({"role": "user", "content": f"u{i}"})
        mensajes.append({"role": "assistant", "content": f"a{i}"})
    recortado = trim_chat_history(mensajes, max_messages=6, max_chars=10_000)
    assert recortado[0]["role"] == "system"
    assert len(recortado) == 7
    assert recortado[1]["role"] == "user"
    assert recortado[-1]["content"] == "a19"

    largo = [{"role": "user", "content": "x" * 5000}, {"role": "assistant", "content": "y" * 5000}, {"role": "user", "content": "última"}]
    assert trim_chat_history(largo, max_messages=10, max_chars=100) == [{"role": "user", "content": "última"}]


def test_salida_json_invalida_se_repara_en_segunda_llamada(client, api_v1_prefix, monkeypatch):
    llamadas: list[list[dict]] = []
    valido = {
        "respuesta": "Texto",
        "evidencias": [{"norma": "Decreto X", "articulo": "3", "razon": "r"}],
        "nivel_confianza": 0.7,
        "requiere_revision_humana": True,
    }

    async def _stream_chat(provider, messages, api_key, model=None, generator_type=None, json_mode=False):
        llamadas.append(messages)
        if len(llamadas) == 1:
            yield json.dumps({"respuesta": "Texto"})  # faltan claves obligatorias
        else:
            assert json_mode is True
            yield json.dumps(valido)

    monkeypatch.setattr(generators_module.AIService, "stream_chat", staticmethod(_stream_chat))
    resp = client.post(
        f"{api_v1_prefix}/generators/normativa",
        json={
            "consulta": "¿Puede un centro sancionar sin audiencia previa?",
            "contexto": "Decreto 8/2015 (Galicia), artículo 45: trámite de audiencia al alumnado y familias antes de la sanción.",
            "provider": "edumind",
        },
    )
    assert resp.status_code == 200, resp.text
    documento = json.loads(resp.text)
    assert documento["requiere_revision_humana"] is True
    assert len(llamadas) == 2
    assert "no cumple el esquema" in llamadas[1][-1]["content"]


def test_export_docx_devuelve_un_documento_word(client, api_v1_prefix):
    resp = client.post(
        f"{api_v1_prefix}/export/docx",
        json={"title": "Sesión 1", "content": "OBJETIVOS\n- Saltar\n- Correr\nDesarrollo de la sesión.", "filename": "sesion 1"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert resp.content[:2] == b"PK"
    assert 'filename="sesion_1.docx"' in resp.headers["content-disposition"]
