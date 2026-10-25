#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Especificación única de cada herramienta: etiqueta, objetivo, secciones y reglas.

Es la fuente que usa el navegador en modo local (se sirve en /generators/local-contracts)
y la referencia para los prompts del servidor. Antes existía una copia en
local-prompt-builder.ts que divergía (p. ej. las preguntas locales ya no eran GIFT).
"""

from typing import Any

TOOL_SPECS: dict[str, dict[str, Any]] = {
    "planning": {
        "label": "Planificación didáctica",
        "objective": "Genera una propuesta didáctica coherente, aplicable y publicable para el sistema educativo español.",
        "sections": ["Datos identificativos", "Objetivos de aprendizaje", "Contenidos", "Metodología detallada", "Secuenciación de actividades", "Criterios de evaluación", "Recursos"],
    },
    "situation": {
        "label": "Situación de aprendizaje",
        "objective": "Construye una situación de aprendizaje completa, con secuencia didáctica y medidas inclusivas.",
        "sections": ["Título y justificación", "Concreción curricular", "Secuencia didáctica sesión a sesión", "Medidas de atención a la diversidad", "Evaluación", "Recursos y tecnología"],
    },
    "project": {
        "label": "Proyecto educativo",
        "objective": "Diseña un proyecto educativo técnico con fases claras y evaluación aplicable.",
        "sections": ["Visión general", "Objetivos", "Fases", "Recursos", "Evaluación"],
    },
    "stem": {
        "label": "Proyecto STEM",
        "objective": "Plantea un proyecto STEM con producto final, justificación, inclusión y evaluación.",
        "sections": ["Visión general", "Objetivos", "Justificación", "Plan de proyecto", "Atención a NEAE", "Rúbrica"],
    },
    "diversity": {
        "label": "Intervención de diversidad",
        "objective": "Redacta una respuesta orientadora anonimizada con objetivos SMART, plan de intervención y seguimiento.",
        "sections": ["Contexto", "Objetivos SMART", "Plan de intervención", "Seguimiento", "Marco normativo"],
        "rules": ["Refiérete siempre a \"el/la alumno/a\" o \"el grupo\"; no reproduzcas ni pidas datos identificativos."],
    },
    "session": {
        "label": "Sesión competencial",
        "objective": "Diseña una sesión con cronograma detallado, evaluación formativa e inclusión.",
        "sections": ["Contexto", "Objetivos operativos", "Cronograma detallado", "Evaluación formativa", "Inclusión", "Recursos digitales"],
    },
    "topic": {
        "label": "Tema de oposición",
        "objective": "Desarrolla un tema de oposición con estructura académica rigurosa y cierre sólido.",
        "sections": ["Introducción", "Desarrollo por epígrafes", "Innovación educativa", "Conclusión", "Bibliografía de referencia"],
    },
    "case": {
        "label": "Supuesto práctico",
        "objective": "Genera un supuesto práctico con análisis, propuesta operativa, riesgos y acciones priorizadas.",
        "sections": ["Análisis", "Propuesta", "Normativa clave", "Riesgos", "Acciones prioritarias"],
        "rules": ["No inventes normativa fuera de los datos aportados.", "Activa requiere_revision_humana si la situación es ambigua o depende de documentos no aportados."],
    },
    "defense": {
        "label": "Defensa oral o evaluación",
        "objective": "Devuelve una valoración estructurada y útil para tribunal u opositor.",
        "sections": ["Veredicto", "Puntuación global", "Fortalezas", "Mejoras", "Normativa recomendada", "Próximos pasos"],
    },
    "idea": {
        "label": "Idea didáctica",
        "objective": "Propone una idea educativa concreta, realista y accionable.",
        "sections": ["Idea central", "Aplicación en aula", "Recursos", "Evaluación rápida"],
    },
    "minutes": {
        "label": "Acta o minuta",
        "objective": "Redacta un acta clara y formal con acuerdos y seguimiento.",
        "sections": ["Contexto", "Asistentes", "Temas tratados", "Acuerdos", "Seguimiento"],
    },
    "institution_doc": {
        "label": "Documento institucional",
        "objective": "Genera un documento institucional bien estructurado y publicable.",
        "sections": ["Contexto", "Análisis", "Fortalezas y debilidades", "Oportunidades y amenazas", "Plan de mejora"],
    },
    "inspection_report": {
        "label": "Documento de inspección educativa",
        "objective": "Redacta una respuesta técnica, verificable y orientada a auditoría o inspección.",
        "sections": ["Resumen ejecutivo", "Hechos relevantes", "Riesgos prioritarios", "Actuaciones requeridas", "Normativa relevante", "Alertas"],
        "rules": ["No inventes evidencias, fechas, responsables ni decisiones no respaldadas por los datos.", "Marca requiere_revision_humana=true si faltan evidencias críticas o hay ambigüedad documental."],
    },
    "reinforcement_plan": {
        "label": "Plan de refuerzo",
        "objective": "Genera un plan de refuerzo anónimo, claro y orientado a seguimiento educativo.",
        "sections": ["Resumen de necesidad", "Objetivos prioritarios", "Actuaciones", "Seguimiento", "Indicadores", "Alertas"],
    },
    "rubrics": {
        "label": "Rúbrica",
        "objective": "Construye una rúbrica de cuatro niveles con descriptores observables y graduados, alineada con el currículo oficial si se aporta.",
        "sections": ["Criterios", "Niveles de desempeño", "Descriptores observables por nivel"],
    },
    "worksheets": {
        "label": "Fichas y actividades",
        "objective": "Crea materiales listos para el aula, con claridad y nivel adecuado.",
        "sections": ["Objetivo", "Instrucciones", "Actividades", "Cierre o autocorrección"],
    },
    "methodology": {
        "label": "Asesor metodológico",
        "objective": "Propone una orientación metodológica aplicable y bien argumentada.",
        "sections": ["Diagnóstico", "Propuesta metodológica", "Aplicación en aula", "Seguimiento"],
    },
    "organization": {
        "label": "Organización de aula",
        "objective": "Diseña una organización de aula funcional, segura y coherente con la metodología.",
        "sections": ["Diagnóstico", "Distribución del espacio", "Recursos", "Rutinas y normas", "Ajustes para la casuística"],
    },
    "questions": {
        "label": "Banco de preguntas (GIFT)",
        "objective": "Genera preguntas evaluativas en formato GIFT válido, importable en Moodle, adecuadas a la dificultad solicitada.",
        "sections": ["Preguntas en formato GIFT (una por bloque, con respuestas marcadas)", "Solucionario breve", "Indicación de dificultad"],
        "rules": ["Devuelve únicamente bloques GIFT válidos (sin numeración ni texto fuera de los bloques)."],
    },
    "normativa": {
        "label": "Respuesta normativa",
        "objective": "Responde solo con base en el contexto normativo aportado y deja claro el nivel de confianza.",
        "sections": ["Respuesta", "Evidencias", "Nivel de confianza", "Requiere revisión humana", "Alertas"],
        "rules": ["No cites normas ni artículos fuera del contexto facilitado.", "Si el contexto no permite cerrar una conclusión, indícalo y activa requiere_revision_humana."],
    },
}


def get_tool_spec(tool: str) -> dict[str, Any] | None:
    return TOOL_SPECS.get((tool or "").strip().lower())
