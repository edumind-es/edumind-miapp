#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Evals deterministas de prompts: se ejecutan en cada CI sin necesidad de un modelo."""

import json
from pathlib import Path

import pytest

from app.core.prompt_registry import (
    POSITIVE_FIELDS_BY_TOOL,
    PROMPT_CONTRACTS,
    REQUIRED_FIELDS_BY_TOOL,
    get_generator_prompt,
)
from app.services.curriculum_matrix_service import CurriculumMatrixService

EVALS = Path(__file__).resolve().parents[1] / "evals"
BUDGETS = json.loads((EVALS / "budgets.json").read_text(encoding="utf-8"))
GOLDEN = json.loads((EVALS / "golden_set.json").read_text(encoding="utf-8"))


def _payload_minimo(tool: str) -> dict:
    """Payload sintético: cada campo obligatorio lleva un valor reconocible para rastrearlo en el prompt."""
    datos = {campo: f"Valor {campo} {tool}" for campo in REQUIRED_FIELDS_BY_TOOL.get(tool, {})}
    for campo in POSITIVE_FIELDS_BY_TOOL.get(tool, {}):
        datos[campo] = 3
    if tool == "defense":
        datos["modo"] = "generar"
    if tool == "reinforcement_plan":
        datos["contenidos_refuerzo"] = ["Valor contenidos_refuerzo reinforcement_plan"]
    return datos


# Campos de control: condicionan el prompt pero no tienen por qué aparecer literalmente.
CAMPOS_DE_CONTROL = {"modo", "response_format", "provider", "api_key"}


def _valores(datos: dict) -> list[str]:
    salida: list[str] = []
    for clave, valor in datos.items():
        if clave in CAMPOS_DE_CONTROL:
            continue
        if isinstance(valor, list):
            salida.extend(str(v) for v in valor)
        elif isinstance(valor, str):
            salida.append(valor)
    return salida


@pytest.mark.parametrize("tool", sorted(PROMPT_CONTRACTS))
def test_eval_prompt_conserva_datos_y_respeta_reglas(tool):
    datos = {**_payload_minimo(tool), **GOLDEN.get(tool, {})}
    bundle = get_generator_prompt(tool, datos)
    texto = bundle.prompt_text

    for valor in _valores(datos):
        assert valor in texto, f"{tool}: el dato '{valor}' no llega al prompt"

    for frase in BUDGETS["forbidden_phrases"]:
        assert frase not in texto, f"{tool}: frase prohibida '{frase}'"

    tope = BUDGETS["max_prompt_chars_by_tool"].get(tool, BUDGETS["max_prompt_chars_default"])
    assert len(texto) <= tope, f"{tool}: prompt de {len(texto)} caracteres supera el tope {tope}"

    if bundle.response_format == "json":
        assert "JSON Schema" in texto, f"{tool}: falta el bloque de salida estructurada"


@pytest.mark.parametrize("tool", ["session", "situation", "reinforcement_plan", "rubrics", "worksheets"])
def test_eval_marco_curricular_llega_al_prompt(tool):
    matrices = CurriculumMatrixService.list_matrices(comunidad="galicia", etapa="primaria")
    if not matrices:
        pytest.skip("índice curricular no disponible")
    matriz = next((m for m in matrices if m["area_key"] == "educacion-fisica"), matrices[0])
    datos = {**_payload_minimo(tool), **GOLDEN.get(tool, {}), "matriz_curricular": {"id": matriz["id"]}}
    enriquecido = CurriculumMatrixService.enrich_generator_payload(datos)
    bundle = get_generator_prompt(tool, enriquecido)
    assert "MARCO CURRICULAR OFICIAL" in bundle.prompt_text, f"{tool}: la matriz no se inyecta en el prompt"
