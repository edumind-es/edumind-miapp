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

from pydantic import BaseModel, ConfigDict
from typing import List, Optional

# Base schema with optional contextual fields
class ContextualFieldsMixin(BaseModel):
    # Optional enrichment fields
    num_alumnos: Optional[int] = None
    tipo_agrupamiento: Optional[str] = None
    metodologia_slider: Optional[int] = None  # 0-100
    neae_cases: Optional[List[str]] = None
    neae_otros: Optional[str] = None
    contexto_adicional: Optional[str] = None

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    messages: List[Message]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    save_to_dataset: bool = False

# Generator Schemas
class PlanningRequest(ContextualFieldsMixin):
    curso: str
    horas: int
    objetivo: str
    metodologia_tipo: str  # Tradicional, Intermedia, Innovadora
    metodologia_texto: str # Individual, Grupos, etc.
    provider: str = "edumind"
    api_key: Optional[str] = None

class SituationRequest(ContextualFieldsMixin):
    curso: str
    etapa_educativa: str
    modelo_pedagogico: str
    tipo_tarea: str
    estilo_ensenanza: str
    contenidos: str
    objetivos: str
    criterios_evaluacion: str
    casos_neae: str
    temporalizacion: str
    tipo_temporalizacion: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class ProjectRequest(BaseModel):
    nombre_proyecto: str
    descripcion: str
    objetivos: str
    materiales: str
    provider: str = "edumind"
    api_key: Optional[str] = None

# Docentes Extra
class SteamRequest(ContextualFieldsMixin):
    producto: str
    curso: str
    materiales: str
    neae: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class DiversityRequest(BaseModel):
    caso: str
    intervencion_actual: str
    resultados: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class SessionRequest(ContextualFieldsMixin):
    tema: str
    curso: str
    descripcion: str
    provider: str = "edumind"
    api_key: Optional[str] = None

# Opositores
class TopicRequest(BaseModel):
    numero: str
    titulo: str
    cuerpo: str
    especialidad: str
    parte: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class CaseRequest(BaseModel):
    cuerpo: str
    especialidad: str
    numero_preguntas: str
    tiempo_respuesta: str
    incluir_nee: str
    incluir_normativa: str
    response_format: str = "json"  # text | json
    provider: str = "edumind"
    api_key: Optional[str] = None

class DefenseRequest(BaseModel):
    # This was 'solucionador' in legacy, adapting for generic defense/support
    especialidad: str
    normativa: str
    enunciado: str
    modo: str = "modelo" # 'modelo' or 'evaluar'
    respuesta_usuario: Optional[str] = None
    response_format: str = "json"  # text | json
    provider: str = "edumind"
    api_key: Optional[str] = None

class IdeaRequest(BaseModel):
    consulta: str
    provider: str = "edumind"
    api_key: Optional[str] = None

# Centros
class MinutesRequest(BaseModel):
    tipo: str
    fecha: str
    presentes: str
    temas: str
    acuerdos: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class InstitutionDocRequest(BaseModel):
    tipo: str
    seccion: str
    contexto: str
    fortalezas: str
    debilidades: str
    oportunidades: str
    amenazas: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class InspectionReportRequest(BaseModel):
    tipo_documento: str  # informe, acta_seguimiento, respuesta_requerimiento, plan_actuacion
    subplantilla: Optional[str] = None  # plantilla operativa específica del documento
    ambito: str  # convivencia, inclusion, evaluacion, organizacion, etc.
    demanda_inspeccion: str
    hallazgos: str
    actuaciones_previas: str
    evidencias: str
    plazo_respuesta: str
    normativa_aplicable: str
    response_format: str = "json"  # text | json
    provider: str = "edumind"
    api_key: Optional[str] = None


class ReinforcementPlanRequest(BaseModel):
    # Privacy-first: reject unknown fields to avoid accidental personal data keys.
    model_config = ConfigDict(extra="forbid")

    area_educativa: str
    curso: str
    etapa_educativa: str
    fecha_inicio_refuerzo: str
    fecha_fin_estimada: str
    contenidos_refuerzo: List[str]
    criterios_evaluacion: str
    instrumentos_evaluacion: str
    evidencias_necesidad_refuerzo: str
    forma_trabajo_aplicada: str
    recursos_empleados: str
    desarrollo_aplicado: str
    normativa_aplicable: Optional[str] = None
    response_format: str = "json"  # text | json
    provider: str = "edumind"
    api_key: Optional[str] = None


class RubricsRequest(BaseModel):
    nombre: str
    area: str
    criterios: int
    descripcion: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class WorksheetRequest(ContextualFieldsMixin):
    tema: str
    objetivo: str
    tipo: str # "fichas", "cuestionario", etc.
    edad: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class MethodologyRequest(ContextualFieldsMixin):
    contenido: str
    grupo: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class OrganizationRequest(ContextualFieldsMixin):
    metodologia: str
    espacio: str
    recursos: str
    casuistica: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class QuestionRequest(BaseModel):
    texto_fuente: str
    tipo_pregunta: str # "multiple_choice", "true_false", "matching"
    cantidad: int
    dificultad: str
    provider: str = "edumind"
    api_key: Optional[str] = None

class NormativeRequest(BaseModel):
    consulta: str
    contexto: str
    response_format: str = "json"  # text | json
    provider: str = "edumind"
    api_key: Optional[str] = None
