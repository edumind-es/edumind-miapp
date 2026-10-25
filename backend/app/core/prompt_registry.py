#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

"""Prompt registry for generator tools with versioning and contracts."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Callable

from app.core import prompts
from app.core.tool_specs import get_tool_spec

PromptBuilder = Callable[[dict[str, Any]], str]


@dataclass(frozen=True)
class PromptContract:
    tool: str
    prompt_id: str
    version: str
    risk_level: str
    builder: PromptBuilder
    output_schema: dict[str, Any] | None = None
    default_response_format: str = "text"


@dataclass(frozen=True)
class PromptBundle:
    tool: str
    prompt_id: str
    prompt_version: str
    risk_level: str
    response_format: str
    prompt_text: str
    output_schema: dict[str, Any] | None
    sanitized_payload: dict[str, Any]


class PromptValidationError(ValueError):
    """Raised when the generator payload is incomplete or not publishable."""


NORMATIVE_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["respuesta", "evidencias", "nivel_confianza", "requiere_revision_humana"],
    "properties": {
        "respuesta": {"type": "string"},
        "evidencias": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["norma", "articulo", "razon"],
                "properties": {
                    "norma": {"type": "string"},
                    "articulo": {"type": "string"},
                    "razon": {"type": "string"},
                },
            },
        },
        "nivel_confianza": {"type": "number", "minimum": 0, "maximum": 1},
        "requiere_revision_humana": {"type": "boolean"},
        "alertas": {"type": "array", "items": {"type": "string"}},
    },
}

OPPOSITION_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "analisis",
        "propuesta",
        "normativa_clave",
        "riesgos",
        "acciones_prioritarias",
        "requiere_revision_humana",
    ],
    "properties": {
        "analisis": {"type": "string"},
        "propuesta": {"type": "string"},
        "normativa_clave": {"type": "array", "items": {"type": "string"}},
        "riesgos": {"type": "array", "items": {"type": "string"}},
        "acciones_prioritarias": {"type": "array", "items": {"type": "string"}},
        "nivel_confianza": {"type": "number", "minimum": 0, "maximum": 1},
        "requiere_revision_humana": {"type": "boolean"},
    },
}

DEFENSE_EVAL_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "veredicto",
        "puntuacion_global",
        "fortalezas",
        "mejoras",
        "normativa_recomendada",
        "requiere_revision_humana",
    ],
    "properties": {
        "veredicto": {"type": "string"},
        "puntuacion_global": {"type": "number", "minimum": 0, "maximum": 10},
        "fortalezas": {"type": "array", "items": {"type": "string"}},
        "mejoras": {"type": "array", "items": {"type": "string"}},
        "normativa_recomendada": {"type": "array", "items": {"type": "string"}},
        "proximos_pasos": {"type": "array", "items": {"type": "string"}},
        "requiere_revision_humana": {"type": "boolean"},
    },
}

INSPECTION_REPORT_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "resumen_ejecutivo",
        "hechos_relevantes",
        "riesgos_prioritarios",
        "actuaciones_requeridas",
        "normativa_relevante",
        "requiere_revision_humana",
    ],
    "properties": {
        "resumen_ejecutivo": {"type": "string"},
        "hechos_relevantes": {"type": "array", "items": {"type": "string"}},
        "riesgos_prioritarios": {"type": "array", "items": {"type": "string"}},
        "actuaciones_requeridas": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["accion", "responsable", "plazo"],
                "properties": {
                    "accion": {"type": "string"},
                    "responsable": {"type": "string"},
                    "plazo": {"type": "string"},
                    "evidencia_asociada": {"type": "string"},
                },
            },
        },
        "normativa_relevante": {"type": "array", "items": {"type": "string"}},
        "alertas": {"type": "array", "items": {"type": "string"}},
        "requiere_revision_humana": {"type": "boolean"},
    },
}

# Rúbrica estructurada: la tabla se compone en el cliente (HTML, CSV para iDoceo/Additio, Word).
RUBRIC_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["titulo", "niveles", "criterios", "requiere_revision_humana"],
    "properties": {
        "titulo": {"type": "string"},
        "area": {"type": "string"},
        "niveles": {"type": "array", "items": {"type": "string"}},
        "criterios": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["criterio", "descriptores"],
                "properties": {
                    "criterio": {"type": "string"},
                    "codigo_curricular": {"type": "string"},
                    "descriptores": {"type": "array", "items": {"type": "string"}},
                    "peso": {"type": "number", "minimum": 0, "maximum": 100},
                },
            },
        },
        "observaciones": {"type": "string"},
        "requiere_revision_humana": {"type": "boolean"},
    },
}

REINFORCEMENT_PLAN_JSON_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "resumen_necesidad",
        "objetivos_prioritarios",
        "actuaciones",
        "seguimiento",
        "indicadores",
        "requiere_revision_humana",
    ],
    "properties": {
        "resumen_necesidad": {"type": "string"},
        "objetivos_prioritarios": {"type": "array", "items": {"type": "string"}},
        "actuaciones": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["accion", "frecuencia", "responsable", "evidencia_esperada"],
                "properties": {
                    "accion": {"type": "string"},
                    "frecuencia": {"type": "string"},
                    "responsable": {"type": "string"},
                    "evidencia_esperada": {"type": "string"},
                },
            },
        },
        "seguimiento": {"type": "array", "items": {"type": "string"}},
        "indicadores": {"type": "array", "items": {"type": "string"}},
        "alertas": {"type": "array", "items": {"type": "string"}},
        "requiere_revision_humana": {"type": "boolean"},
    },
}

TEXT_QUALITY_ENABLED_TOOLS = {
    "planning",
    "situation",
    "project",
    "stem",
    "diversity",
    "session",
    "topic",
    "idea",
    "minutes",
    "institution_doc",
    "inspection_report",
    "reinforcement_plan",
    "worksheets",
    "methodology",
    "organization",
}

PLACEHOLDER_VALUES = {
    "n a",
    "na",
    "no aplica",
    "no aportado",
    "no aportada",
    "no aportados",
    "no aportadas",
    "no definido",
    "no definida",
    "no disponibles",
    "no disponible",
    "no especificado",
    "no especificada",
    "no especificados",
    "no especificadas",
    "pendiente",
    "pendiente de completar",
    "pendiente de definir",
    "por definir",
    "por concretar",
    "sin concretar",
    "sin definir",
}

REQUIRED_FIELDS_BY_TOOL: dict[str, dict[str, str]] = {
    "planning": {
        "curso": "curso",
        "horas": "horas",
        "objetivo": "objetivo",
        "metodologia_tipo": "tipo de metodología",
        "metodologia_texto": "descripción metodológica",
    },
    "situation": {
        "curso": "curso",
        "etapa_educativa": "etapa educativa",
        "modelo_pedagogico": "modelo pedagógico",
        "tipo_tarea": "tipo de tarea",
        "estilo_ensenanza": "estilo de enseñanza",
        "contenidos": "contenidos",
        "objetivos": "objetivos",
        "criterios_evaluacion": "criterios de evaluación",
        "temporalizacion": "temporalización",
    },
    "project": {
        "nombre_proyecto": "nombre del proyecto",
        "descripcion": "descripción",
        "objetivos": "objetivos",
        "materiales": "materiales",
    },
    "stem": {
        "producto": "producto final",
        "curso": "curso",
        "materiales": "materiales",
    },
    "diversity": {
        "caso": "caso",
        "intervencion_actual": "intervención actual",
        "resultados": "resultados",
    },
    "session": {
        "tema": "tema",
        "curso": "curso",
        "descripcion": "descripción",
    },
    "topic": {
        "numero": "número de tema",
        "titulo": "título",
        "cuerpo": "cuerpo",
        "especialidad": "especialidad",
        "parte": "parte",
    },
    "case": {
        "cuerpo": "cuerpo docente",
        "especialidad": "especialidad",
        "numero_preguntas": "número de preguntas",
        "tiempo_respuesta": "tiempo de respuesta",
    },
    "defense": {
        "especialidad": "especialidad",
        "enunciado": "enunciado",
    },
    "idea": {
        "consulta": "consulta",
    },
    "minutes": {
        "tipo": "tipo",
        "fecha": "fecha",
        "presentes": "asistentes",
        "temas": "temas",
        "acuerdos": "acuerdos",
    },
    "institution_doc": {
        "tipo": "tipo de documento",
        "seccion": "sección",
        "contexto": "contexto",
        "fortalezas": "fortalezas",
        "debilidades": "debilidades",
        "oportunidades": "oportunidades",
        "amenazas": "amenazas",
    },
    "inspection_report": {
        "tipo_documento": "tipo de documento",
        "ambito": "ámbito",
        "demanda_inspeccion": "demanda de inspección",
        "hallazgos": "hallazgos",
        "evidencias": "evidencias",
        "plazo_respuesta": "plazo de respuesta",
    },
    "reinforcement_plan": {
        "area_educativa": "área educativa",
        "curso": "curso",
        "etapa_educativa": "etapa educativa",
        "fecha_inicio_refuerzo": "fecha de inicio",
        "fecha_fin_estimada": "fecha fin estimada",
        "contenidos_refuerzo": "contenidos de refuerzo",
        "criterios_evaluacion": "criterios de evaluación",
        "instrumentos_evaluacion": "instrumentos de evaluación",
        "evidencias_necesidad_refuerzo": "evidencias de necesidad",
        "forma_trabajo_aplicada": "forma de trabajo aplicada",
        "recursos_empleados": "recursos empleados",
        "desarrollo_aplicado": "desarrollo aplicado",
    },
    "rubrics": {
        "nombre": "nombre",
        "area": "área",
        "criterios": "número de criterios",
        "descripcion": "descripción",
    },
    "worksheets": {
        "tema": "tema",
        "objetivo": "objetivo",
        "tipo": "tipo",
        "edad": "edad o nivel",
    },
    "methodology": {
        "contenido": "contenido",
        "grupo": "grupo",
    },
    "organization": {
        "metodologia": "metodología",
        "espacio": "espacio",
        "recursos": "recursos",
        "casuistica": "casuística",
    },
    "questions": {
        "texto_fuente": "texto fuente",
        "tipo_pregunta": "tipo de pregunta",
        "cantidad": "cantidad",
        "dificultad": "dificultad",
    },
    "normativa": {
        "consulta": "consulta",
        "contexto": "contexto normativo recuperado",
    },
}

POSITIVE_FIELDS_BY_TOOL: dict[str, dict[str, str]] = {
    "planning": {"horas": "horas"},
    "case": {
        "numero_preguntas": "número de preguntas",
        "tiempo_respuesta": "tiempo de respuesta",
    },
    "rubrics": {"criterios": "número de criterios"},
    "questions": {"cantidad": "cantidad"},
}


def _text_quality_block(tool: str) -> str:
    return f"""

CONTRATO DE CALIDAD DE RESPUESTA (OBLIGATORIO):
- Mantén la estructura principal ya pedida para este generador.
- Evita frases vacías, relleno y repeticiones.
- Basa la propuesta en los datos recibidos; si falta un dato crítico, indícalo en una sola línea en el bloque de límites.
- No inventes normativa, evidencias, fechas, responsables ni decisiones no apoyadas en los datos recibidos.
- Asegura coherencia entre objetivos, acciones, recursos, evaluación y atención a la diversidad.
- Termina con un bloque breve "LÍMITES Y SUPUESTOS" (3 líneas como máximo) solo si hubo datos ausentes o decisiones asumidas.
"""


PROMPT_CONTRACTS: dict[str, PromptContract] = {
    "planning": PromptContract("planning", "planning.didactic", "2.0.0", "medium", prompts.build_planning_prompt),
    "situation": PromptContract("situation", "situation.learning", "2.0.0", "medium", prompts.build_situation_prompt),
    "project": PromptContract("project", "project.educational", "2.0.0", "medium", prompts.build_project_prompt),
    "stem": PromptContract("stem", "stem.project", "2.0.0", "medium", prompts.build_stem_prompt),
    "diversity": PromptContract("diversity", "diversity.intervention", "2.0.0", "high", prompts.build_diversity_prompt),
    "session": PromptContract("session", "session.design", "2.0.0", "medium", prompts.build_session_prompt),
    "topic": PromptContract("topic", "opposition.topic", "2.0.0", "high", prompts.build_topic_prompt),
    "case": PromptContract(
        "case",
        "opposition.case",
        "2.0.0",
        "high",
        prompts.build_case_prompt,
        output_schema=OPPOSITION_JSON_SCHEMA,
        default_response_format="json",
    ),
    "defense": PromptContract(
        "defense",
        "opposition.defense",
        "2.0.0",
        "high",
        prompts.build_defense_prompt,
        output_schema=DEFENSE_EVAL_JSON_SCHEMA,
        default_response_format="json",
    ),
    "idea": PromptContract("idea", "opposition.idea", "2.0.0", "medium", prompts.build_idea_prompt),
    "minutes": PromptContract("minutes", "institution.minutes", "2.0.0", "medium", prompts.build_minutes_prompt),
    "institution_doc": PromptContract(
        "institution_doc", "institution.document", "2.0.0", "high", prompts.build_institution_doc_prompt
    ),
    "inspection_report": PromptContract(
        "inspection_report",
        "inspection.center",
        "1.0.0",
        "high",
        prompts.build_inspection_report_prompt,
        output_schema=INSPECTION_REPORT_JSON_SCHEMA,
        default_response_format="json",
    ),
    "reinforcement_plan": PromptContract(
        "reinforcement_plan",
        "diversity.reinforcement_plan",
        "1.0.0",
        "high",
        prompts.build_reinforcement_plan_prompt,
        output_schema=REINFORCEMENT_PLAN_JSON_SCHEMA,
        default_response_format="json",
    ),
    "rubrics": PromptContract(
        "rubrics",
        "assessment.rubric",
        "3.0.0",
        "medium",
        prompts.build_rubric_prompt,
        output_schema=RUBRIC_JSON_SCHEMA,
        default_response_format="json",
    ),
    "worksheets": PromptContract("worksheets", "worksheet.generator", "2.0.0", "medium", prompts.build_worksheet_prompt),
    "methodology": PromptContract(
        "methodology", "methodology.advisor", "2.0.0", "medium", prompts.build_methodology_prompt
    ),
    "organization": PromptContract(
        "organization", "organization.classroom", "2.0.0", "high", prompts.build_organization_prompt
    ),
    "questions": PromptContract("questions", "assessment.questions", "2.0.0", "high", prompts.build_question_prompt),
    "normativa": PromptContract(
        "normativa",
        "normative.galicia",
        "2.0.0",
        "high",
        prompts.build_normative_prompt,
        output_schema=NORMATIVE_JSON_SCHEMA,
        default_response_format="json",
    ),
}


def _sanitize_str(value: str) -> str:
    sanitized = value.replace("\x00", "").replace("```", "'''")
    sanitized = sanitized.strip()
    if _is_placeholder_value(sanitized):
        return ""
    return sanitized


def _sanitize_payload(value: Any) -> Any:
    if isinstance(value, str):
        return _sanitize_str(value)
    if isinstance(value, list):
        sanitized_items = [_sanitize_payload(item) for item in value]
        return [item for item in sanitized_items if item not in ("", [], {}, None)]
    if isinstance(value, dict):
        return {
            str(key): sanitized
            for key, val in value.items()
            if (sanitized := _sanitize_payload(val)) not in ("", [], {}, None)
        }
    return value


def _normalize_text_token(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized.lower()).strip()
    return normalized


def _is_placeholder_value(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    normalized = _normalize_text_token(value)
    if not normalized:
        return True
    return (
        normalized in PLACEHOLDER_VALUES
        or normalized.startswith("no especificad")
        or normalized.startswith("no aportad")
        or normalized.startswith("pendiente")
    )


def _has_meaningful_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return not _is_placeholder_value(value)
    if isinstance(value, list):
        return any(_has_meaningful_value(item) for item in value)
    if isinstance(value, dict):
        return any(_has_meaningful_value(item) for item in value.values())
    return True


def _is_positive_number(value: Any) -> bool:
    if isinstance(value, bool) or value is None:
        return False
    if isinstance(value, (int, float)):
        return value > 0
    if isinstance(value, str):
        try:
            direct_value = value.strip().replace(",", ".")
            return float(direct_value) > 0
        except ValueError:
            match = re.search(r"-?\d+(?:[.,]\d+)?", value)
            if not match:
                return False
            return float(match.group(0).replace(",", ".")) > 0
    return False


def _validate_payload(tool: str, payload: dict[str, Any]) -> None:
    missing_fields = [
        label
        for field, label in REQUIRED_FIELDS_BY_TOOL.get(tool, {}).items()
        if not _has_meaningful_value(payload.get(field))
    ]
    if tool == "defense" and payload.get("modo") == "evaluar" and not _has_meaningful_value(payload.get("respuesta_usuario")):
        missing_fields.append("respuesta del usuario")
    if missing_fields:
        raise PromptValidationError(
            "Faltan datos obligatorios para generar un resultado fiable: "
            + ", ".join(sorted(set(missing_fields)))
            + "."
        )

    invalid_positive_fields = [
        label
        for field, label in POSITIVE_FIELDS_BY_TOOL.get(tool, {}).items()
        if not _is_positive_number(payload.get(field))
    ]
    if invalid_positive_fields:
        raise PromptValidationError(
            "Estos campos deben ser mayores que cero: " + ", ".join(sorted(set(invalid_positive_fields))) + "."
        )


def _resolve_response_format(payload: dict[str, Any], contract: PromptContract) -> str:
    requested = str(payload.get("response_format") or contract.default_response_format).lower().strip()
    if requested not in {"text", "json"}:
        return "text"
    if requested == "json" and not contract.output_schema:
        return "text"
    return requested


def _structured_output_block(schema: dict[str, Any]) -> str:
    schema_json = json.dumps(schema, ensure_ascii=False, indent=2)
    return f"""

SALIDA ESTRUCTURADA OBLIGATORIA:
- Devuelve EXCLUSIVAMENTE JSON válido.
- No incluyas markdown, comentarios, ni texto fuera del JSON.
- Cumple este JSON Schema exactamente:
{schema_json}
"""


def describe_prompt_contracts_for_client() -> dict[str, Any]:
    """Todo lo que el navegador necesita para sanear, validar y componer el prompt sin enviar el formulario.

    Es la base del modo local honesto (P-02): las plantillas viven en el cliente y el
    servidor solo publica reglas, no recibe datos.
    """
    return {
        "local_prompt_mode": "client_template_v2",
        "placeholder_values": sorted(PLACEHOLDER_VALUES),
        "contracts": [
            {
                "tool": contract.tool,
                "prompt_id": contract.prompt_id,
                "version": contract.version,
                "risk_level": contract.risk_level,
                "supports_json": bool(contract.output_schema),
                "default_response_format": contract.default_response_format,
                "output_schema": contract.output_schema,
                "required_fields": REQUIRED_FIELDS_BY_TOOL.get(contract.tool, {}),
                "positive_fields": POSITIVE_FIELDS_BY_TOOL.get(contract.tool, {}),
                "spec": get_tool_spec(contract.tool),
                "text_quality": contract.tool in TEXT_QUALITY_ENABLED_TOOLS,
            }
            for contract in PROMPT_CONTRACTS.values()
        ],
    }


def list_prompt_contracts() -> list[dict[str, Any]]:
    return [
        {
            "tool": contract.tool,
            "prompt_id": contract.prompt_id,
            "version": contract.version,
            "risk_level": contract.risk_level,
            "supports_json": bool(contract.output_schema),
        }
        for contract in PROMPT_CONTRACTS.values()
    ]


def get_generator_prompt(tool: str, payload: dict[str, Any]) -> PromptBundle:
    normalized_tool = (tool or "").strip().lower().lstrip("/")
    contract = PROMPT_CONTRACTS.get(normalized_tool)
    if not contract:
        raise KeyError(f"Unknown generator tool: {tool}")

    clean_payload = _sanitize_payload(payload or {})
    _validate_payload(contract.tool, clean_payload)
    response_format = _resolve_response_format(clean_payload, contract)

    prompt_text = contract.builder(clean_payload)
    if response_format == "json" and contract.output_schema:
        prompt_text = f"{prompt_text}\n{_structured_output_block(contract.output_schema)}"
    elif response_format == "text" and contract.tool in TEXT_QUALITY_ENABLED_TOOLS:
        prompt_text = f"{prompt_text}\n{_text_quality_block(contract.tool)}"

    return PromptBundle(
        tool=contract.tool,
        prompt_id=contract.prompt_id,
        prompt_version=contract.version,
        risk_level=contract.risk_level,
        response_format=response_format,
        prompt_text=prompt_text,
        output_schema=contract.output_schema if response_format == "json" else None,
        sanitized_payload=clean_payload,
    )
