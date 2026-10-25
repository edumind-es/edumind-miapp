#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.api.v1 import generators as generators_module


def test_los_generadores_no_envian_correos_ni_dni_al_motor(client, api_v1_prefix, monkeypatch):
    recibido: dict = {}

    async def _stream_chat(provider, messages, api_key, model=None, generator_type=None, json_mode=False):
        recibido["prompt"] = messages[-1]["content"]
        yield "Propuesta de intervención anonimizada."

    monkeypatch.setattr(generators_module.AIService, "stream_chat", staticmethod(_stream_chat))
    resp = client.post(
        f"{api_v1_prefix}/generators/diversity",
        json={
            "caso": "Alumno con DNI 12345678Z; la familia escribe desde madre@example.com y llama al 612345678.",
            "intervencion_actual": "Apoyo en el aula",
            "resultados": "Mejora leve",
            "provider": "edumind",
        },
    )
    assert resp.status_code == 200, resp.text
    assert "12345678Z" not in recibido["prompt"]
    assert "madre@example.com" not in recibido["prompt"]
    assert "612345678" not in recibido["prompt"]
    assert "[dni]" in recibido["prompt"]
