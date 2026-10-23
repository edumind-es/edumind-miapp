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


def test_prompt_registry_returns_versioned_bundle_for_classroom():
    bundle = get_generator_prompt(
        "planning",
        {
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Mejorar condición física",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Grupos pequeños",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "planning.didactic"
    assert bundle.prompt_version == "2.0.0"
    assert bundle.risk_level == "medium"
    assert bundle.response_format == "text"
    assert "planificación didáctica" in bundle.prompt_text.lower()
    assert "contrato de calidad de respuesta" in bundle.prompt_text.lower()
    assert "plan de aplicación inmediata (24-72h)" in bundle.prompt_text.lower()


def test_prompt_registry_returns_versioned_bundle_for_organization():
    bundle = get_generator_prompt(
        "organization",
        {
            "metodologia": "ABP",
            "espacio": "Gimnasio y patio",
            "recursos": "Balones y conos",
            "casuistica": "Grupo heterogéneo",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "organization.classroom"
    assert bundle.risk_level == "high"
    assert "diseño de espacios" in bundle.prompt_text.lower()


def test_prompt_registry_returns_bundle_for_inspection_report():
    bundle = get_generator_prompt(
        "inspection_report",
        {
            "tipo_documento": "informe_tecnico",
            "subplantilla": "acta_seguimiento",
            "ambito": "convivencia",
            "demanda_inspeccion": "Aportar evidencias de aplicación del plan de convivencia.",
            "hallazgos": "Registro de incidencias actualizado de forma parcial.",
            "actuaciones_previas": "Reunión de comisión de convivencia.",
            "evidencias": "Actas, partes disciplinarios, plan de mejora.",
            "plazo_respuesta": "10 días hábiles",
            "normativa_aplicable": "Ley 4/2011 y Decreto 8/2015",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "inspection.center"
    assert bundle.prompt_version == "1.0.0"
    assert bundle.risk_level == "high"
    assert bundle.response_format == "json"
    assert bundle.output_schema is not None
    assert "inspeccion educativa" in bundle.prompt_text.lower()
    assert "subplantilla acta de seguimiento" in bundle.prompt_text.lower()
    assert "json schema" in bundle.prompt_text.lower()


def test_prompt_registry_returns_bundle_for_reinforcement_plan():
    bundle = get_generator_prompt(
        "reinforcement_plan",
        {
            "area_educativa": "Matematicas",
            "curso": "4o Primaria",
            "etapa_educativa": "Educacion Primaria",
            "fecha_inicio_refuerzo": "2026-02-20",
            "fecha_fin_estimada": "2026-05-30",
            "contenidos_refuerzo": [
                "Resolucion de problemas con dos operaciones",
                "Fracciones equivalentes",
            ],
            "criterios_evaluacion": "Resuelve problemas contextualizados y comunica estrategias.",
            "instrumentos_evaluacion": "Pruebas escritas, registro de observacion y tareas competenciales.",
            "evidencias_necesidad_refuerzo": "Resultados por debajo de 5 en dos evaluaciones consecutivas.",
            "forma_trabajo_aplicada": "Trabajo guiado en pequeno grupo.",
            "recursos_empleados": "Material manipulativo y cuaderno de apoyo.",
            "desarrollo_aplicado": "Sesiones de 30 minutos, 3 dias por semana.",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "diversity.reinforcement_plan"
    assert bundle.prompt_version == "1.0.0"
    assert bundle.risk_level == "high"
    assert bundle.response_format == "json"
    assert bundle.output_schema is not None
    assert "plan de refuerzo educativo" in bundle.prompt_text.lower()
    assert "decreto 229/2011" in bundle.prompt_text.lower()
    assert "orden del 8 de septiembre de 2021" in bundle.prompt_text.lower()
    assert "json schema" in bundle.prompt_text.lower()


def test_prompt_registry_supports_structured_output_for_normative():
    bundle = get_generator_prompt(
        "normativa",
        {
            "consulta": "¿Cómo actuar ante acoso escolar?",
            "contexto": "Ley 4/2011 y Decreto 8/2015",
            "response_format": "json",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "normative.galicia"
    assert bundle.response_format == "json"
    assert bundle.output_schema is not None
    assert "json schema" in bundle.prompt_text.lower()


def test_prompt_registry_supports_structured_output_for_opposition_case():
    bundle = get_generator_prompt(
        "case",
        {
            "cuerpo": "Secundaria",
            "especialidad": "Educación Física",
            "numero_preguntas": "3",
            "tiempo_respuesta": "90 minutos",
            "incluir_nee": "sí",
            "incluir_normativa": "sí",
            "response_format": "json",
            "provider": "edumind",
        },
    )

    assert bundle.prompt_id == "opposition.case"
    assert bundle.response_format == "json"
    assert bundle.output_schema is not None
    assert "acciones_prioritarias" in str(bundle.output_schema)


def test_prompt_registry_raises_for_unknown_tool():
    try:
        get_generator_prompt("desconocido", {"foo": "bar"})
        raised = False
    except KeyError:
        raised = True

    assert raised


def test_prompt_registry_does_not_inject_quality_block_for_strict_csv_tool():
    bundle = get_generator_prompt(
        "rubrics",
        {
            "nombre": "Rúbrica de ejemplo",
            "area": "EF",
            "criterios": 4,
            "descripcion": "Evaluación de trabajo cooperativo",
            "provider": "edumind",
        },
    )

    assert bundle.response_format == "text"
    assert "estrictamente csv" in bundle.prompt_text.lower()
    assert "contrato de calidad de respuesta" not in bundle.prompt_text.lower()
