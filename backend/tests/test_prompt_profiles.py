#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.core.prompt_registry import get_generator_prompt
from app.core.prompts import ECOSYSTEM_CONTEXT
from app.core.system_prompts import get_prompt_profile, get_system_prompt


def test_los_prompts_no_publicitan_productos_ni_piden_cierre_de_consultoria():
    assert "EDUmind Robotics" not in ECOSYSTEM_CONTEXT
    bundle = get_generator_prompt(
        "session", {"tema": "Saltos", "curso": "5º Primaria", "descripcion": "Sesión de saltos con combas"}
    )
    assert "RESUMEN OPERATIVO" not in bundle.prompt_text
    assert "24-72" not in bundle.prompt_text
    assert "Liga de Valores" not in bundle.prompt_text


def test_perfiles_por_capacidad_y_formato_sin_markdown():
    assert get_prompt_profile("claude") == "full"
    assert get_prompt_profile("edumind") == "medium"
    assert get_prompt_profile("ollama") == "medium"
    completo = get_system_prompt("chatgpt", include_knowledge_context="DOC")
    compacto = get_system_prompt("ollama", include_knowledge_context="DOC")
    assert len(compacto) < len(completo)
    assert "DOC" in completo and "DOC" not in compacto
    for texto in (completo, compacto):
        assert "Usa Markdown" not in texto
        assert "sin Markdown" in texto
