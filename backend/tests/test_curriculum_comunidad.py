#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

import pytest

from app.core.prompts import build_reinforcement_plan_prompt
from app.services.curriculum_matrix_service import CurriculumMatrixService


def test_enriquecer_deriva_la_comunidad_y_el_refuerzo_no_asume_galicia():
    matrices = CurriculumMatrixService.list_matrices(comunidad="madrid", etapa="primaria")
    if not matrices:
        pytest.skip("índice sin matrices de Madrid")
    datos = CurriculumMatrixService.enrich_generator_payload(
        {"matriz_curricular": {"id": matrices[0]["id"]}, "contenidos_refuerzo": ["x"]}
    )
    assert datos["comunidad"] == "Madrid"
    prompt = build_reinforcement_plan_prompt(datos)
    assert "ENCAJE NORMATIVO (Madrid)" in prompt
    assert "Decreto 229/2011" not in prompt


def test_refuerzo_sin_matriz_mantiene_la_referencia_gallega():
    prompt = build_reinforcement_plan_prompt({"contenidos_refuerzo": ["x"]})
    assert "Decreto 229/2011" in prompt
