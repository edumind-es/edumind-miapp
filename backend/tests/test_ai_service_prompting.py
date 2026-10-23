#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.services.ai_service import inject_system_prompt


def test_inject_system_prompt_uses_generator_specific_role_when_provided():
    messages = [{"role": "user", "content": "Genera una planificación didáctica"}]

    enriched = inject_system_prompt(
        messages,
        provider="edumind",
        include_knowledge=False,
        generator_type="planning",
    )

    assert len(enriched) == 2
    assert enriched[0]["role"] == "system"
    assert "rol específico" in enriched[0]["content"].lower()
    assert "diseño curricular" in enriched[0]["content"].lower()


def test_inject_system_prompt_preserves_existing_system_message():
    messages = [
        {"role": "system", "content": "Sistema personalizado"},
        {"role": "user", "content": "Consulta"},
    ]

    enriched = inject_system_prompt(
        messages,
        provider="edumind",
        include_knowledge=True,
        generator_type="planning",
    )

    assert enriched == messages
