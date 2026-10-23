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

import json
import re
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator
from app.models import ResourceType, PlannerEntryStatus


_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
_ACADEMIC_YEAR_RE = re.compile(r"^(\d{4})-(\d{4})$")


def _normalize_required_text(value: str, *, field_name: str, max_length: int) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} excede el máximo de {max_length} caracteres")
    return normalized


def _normalize_optional_text(value: Optional[str], *, field_name: str, max_length: int) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} excede el máximo de {max_length} caracteres")
    return normalized


def _normalize_optional_required_text(value: Optional[str], *, field_name: str, max_length: int) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    if len(normalized) > max_length:
        raise ValueError(f"{field_name} excede el máximo de {max_length} caracteres")
    return normalized


def _normalize_time(value: str, *, field_name: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    try:
        parsed = datetime.strptime(normalized, "%H:%M")
    except ValueError as exc:
        raise ValueError(f"{field_name} debe tener formato HH:MM") from exc
    return parsed.strftime("%H:%M")


def _validate_color(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if not _HEX_COLOR_RE.fullmatch(normalized):
        raise ValueError("color debe tener formato hexadecimal #RRGGBB")
    return normalized.upper()


def _validate_academic_year(value: str) -> str:
    normalized = _normalize_required_text(value, field_name="academic_year", max_length=9)
    match = _ACADEMIC_YEAR_RE.fullmatch(normalized)
    if not match:
        raise ValueError("academic_year debe tener formato YYYY-YYYY")
    start_year = int(match.group(1))
    end_year = int(match.group(2))
    if end_year != start_year + 1:
        raise ValueError("academic_year debe representar cursos consecutivos")
    return normalized


def _validate_json_payload(value: Optional[dict]) -> Optional[dict]:
    if value is None:
        return None
    try:
        encoded = json.dumps(value, ensure_ascii=True)
    except TypeError as exc:
        raise ValueError("generation_params debe ser serializable a JSON") from exc
    if len(encoded) > 20000:
        raise ValueError("generation_params excede el tamaño máximo permitido")
    return value


def _normalize_text_list(
    values: Optional[List[str]],
    *,
    field_name: str,
    item_max_length: int,
    max_items: int,
    allow_empty: bool = True,
) -> List[str]:
    if not values:
        if allow_empty:
            return []
        raise ValueError(f"{field_name} no puede estar vacío")

    normalized_items: List[str] = []
    for raw in values:
        normalized = _normalize_optional_text(raw, field_name=field_name, max_length=item_max_length)
        if normalized:
            normalized_items.append(normalized)

    deduped: List[str] = []
    seen: set[str] = set()
    for item in normalized_items:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    if not deduped and not allow_empty:
        raise ValueError(f"{field_name} no puede estar vacío")
    if len(deduped) > max_items:
        raise ValueError(f"{field_name} excede el máximo de {max_items} elementos")
    return deduped


def _normalize_positive_int_list(values: Optional[List[int]], *, field_name: str, max_items: int) -> List[int]:
    if not values:
        return []
    deduped: List[int] = []
    seen: set[int] = set()
    for value in values:
        if value <= 0:
            raise ValueError(f"{field_name} debe contener identificadores positivos")
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    if len(deduped) > max_items:
        raise ValueError(f"{field_name} excede el máximo de {max_items} elementos")
    return deduped


# ============================================
# TEACHER CLASS SCHEMAS
# ============================================

class TeacherClassCreate(BaseModel):
    """Crear nueva clase - el docente introduce curso, grupo y nº alumnos"""
    course: str  # "3º ESO"
    group: str  # "A"
    subject: str  # "Educación Física"
    academic_year: str  # "2025-2026"
    student_count: int = Field(..., ge=1, le=60)  # Genera códigos automáticamente
    color: Optional[str] = "#3B82F6"

    @field_validator("course")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="course", max_length=40)

    @field_validator("group")
    @classmethod
    def validate_group(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="group", max_length=12)

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="subject", max_length=120)

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: str) -> str:
        return _validate_academic_year(value)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: Optional[str]) -> Optional[str]:
        return _validate_color(value) or "#3B82F6"


class TeacherClassUpdate(BaseModel):
    course: Optional[str] = None
    group: Optional[str] = None
    subject: Optional[str] = None
    academic_year: Optional[str] = None
    student_count: Optional[int] = Field(default=None, ge=1, le=60)
    color: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("course")
    @classmethod
    def validate_course(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_required_text(value, field_name="course", max_length=40)

    @field_validator("group")
    @classmethod
    def validate_group(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_required_text(value, field_name="group", max_length=12)

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_required_text(value, field_name="subject", max_length=120)

    @field_validator("academic_year")
    @classmethod
    def validate_academic_year(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _validate_academic_year(value)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("color no puede estar vacío")
        validated = _validate_color(normalized)
        if validated is None:
            raise ValueError("color no puede estar vacío")
        return validated


class TeacherClassResponse(BaseModel):
    id: int
    user_id: int
    name: str
    course: str
    group: str
    subject: str
    academic_year: str
    student_count: int
    color: str
    is_active: bool

    class Config:
        from_attributes = True


# ============================================
# CLASS SCHEDULE SCHEMAS
# ============================================

class ClassScheduleCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=4)  # 0-4 (Lunes-Viernes)
    start_time: str  # "09:00"
    end_time: str  # "09:55"
    room: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_times(cls, value: str, info) -> str:
        return _normalize_time(value, field_name=info.field_name)

    @field_validator("room")
    @classmethod
    def validate_room(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="room", max_length=80)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time debe ser posterior a start_time")
        return self


class ClassScheduleResponse(BaseModel):
    id: int
    class_id: int
    day_of_week: int
    start_time: str
    end_time: str
    room: Optional[str]

    class Config:
        from_attributes = True


# ============================================
# STUDENT CODE SCHEMAS
# ============================================

class StudentCodeResponse(BaseModel):
    id: int
    class_id: int
    code: str
    number: int
    notes: Optional[str]

    class Config:
        from_attributes = True


class StudentNoteUpdate(BaseModel):
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="notes", max_length=2000)


# ============================================
# GENERATED RESOURCE SCHEMAS
# ============================================

class ResourceSaveRequest(BaseModel):
    """Guardar recurso generado por IA"""
    resource_type: ResourceType
    title: str
    content: str
    generation_params: Optional[dict] = None
    link_to_class_id: Optional[int] = Field(default=None, gt=0)  # Vincular automáticamente

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="title", max_length=200)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="content", max_length=100000)

    @field_validator("generation_params")
    @classmethod
    def validate_generation_params(cls, value: Optional[dict]) -> Optional[dict]:
        return _validate_json_payload(value)


class ResourceResponse(BaseModel):
    id: int
    user_id: int
    resource_type: ResourceType
    title: str
    content: str
    generation_params: Optional[str]

    class Config:
        from_attributes = True


class ResourceLinkRequest(BaseModel):
    class_id: int = Field(..., gt=0)
    assigned_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="notes", max_length=1000)


# ============================================
# PLANNER SCHEMAS
# ============================================

class PlannerEntryCreate(BaseModel):
    class_id: int = Field(..., gt=0)
    entry_date: date
    start_time: str
    end_time: str
    title: str
    description: Optional[str] = None
    resource_id: Optional[int] = Field(default=None, gt=0)
    color: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_times(cls, value: str, info) -> str:
        return _normalize_time(value, field_name=info.field_name)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="title", max_length=200)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="description", max_length=4000)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: Optional[str]) -> Optional[str]:
        return _validate_color(value)

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time debe ser posterior a start_time")
        return self


class PlannerEntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    resource_id: Optional[int] = None
    status: Optional[PlannerEntryStatus] = None
    color: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_required_text(value, field_name="title", max_length=200)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="description", max_length=4000)

    @field_validator("resource_id")
    @classmethod
    def validate_resource_id(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("resource_id debe ser positivo")
        return value

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: Optional[str]) -> Optional[str]:
        return _validate_color(value)


class PlannerEntryResponse(BaseModel):
    id: int
    user_id: int
    class_id: int
    entry_date: date
    start_time: str
    end_time: str
    title: str
    description: Optional[str]
    resource_id: Optional[int]
    status: PlannerEntryStatus
    color: Optional[str]

    class Config:
        from_attributes = True


class WeekPlannerRequest(BaseModel):
    start_date: date  # Lunes de la semana


class PlannerGeneratedSessionResponse(BaseModel):
    session_number: int
    entry_date: date
    day_label: str
    start_time: str
    end_time: str
    title: str
    phase_label: str
    focus: str
    criteria: List[str]
    contents: List[str]
    methodology: str
    dua_diversity: Optional[str]
    resources: List[str]
    description: str


class PlannerSequenceGenerateRequest(BaseModel):
    class_id: int = Field(..., gt=0)
    start_date: date
    session_count: int = Field(..., ge=1, le=30)
    sequence_title: str
    area: str
    stage: Optional[str] = None
    criteria: List[str]
    contents: List[str]
    methodology_slider: int = Field(..., ge=0, le=100)
    methodology_notes: Optional[str] = None
    additional_proposals: Optional[str] = None
    dua_diversity: Optional[str] = None
    web_resources: List[str] = Field(default_factory=list)
    edumind_resource_refs: List[str] = Field(default_factory=list)
    linked_resource_ids: List[int] = Field(default_factory=list)
    edumind_apps: List[str] = Field(default_factory=list)
    external_resource_refs: List[str] = Field(default_factory=list)
    persist: bool = False

    @field_validator("sequence_title")
    @classmethod
    def validate_sequence_title(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="sequence_title", max_length=200)

    @field_validator("area")
    @classmethod
    def validate_area(cls, value: str) -> str:
        return _normalize_required_text(value, field_name="area", max_length=160)

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="stage", max_length=120)

    @field_validator("methodology_notes")
    @classmethod
    def validate_methodology_notes(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="methodology_notes", max_length=1500)

    @field_validator("additional_proposals")
    @classmethod
    def validate_additional_proposals(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="additional_proposals", max_length=2000)

    @field_validator("dua_diversity")
    @classmethod
    def validate_dua_diversity(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_optional_text(value, field_name="dua_diversity", max_length=2000)

    @field_validator("criteria")
    @classmethod
    def validate_criteria(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="criteria",
            item_max_length=400,
            max_items=20,
            allow_empty=False,
        )

    @field_validator("contents")
    @classmethod
    def validate_contents(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="contents",
            item_max_length=400,
            max_items=25,
            allow_empty=False,
        )

    @field_validator("web_resources")
    @classmethod
    def validate_web_resources(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="web_resources",
            item_max_length=300,
            max_items=20,
        )

    @field_validator("edumind_resource_refs")
    @classmethod
    def validate_edumind_resource_refs(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="edumind_resource_refs",
            item_max_length=300,
            max_items=20,
        )

    @field_validator("edumind_apps")
    @classmethod
    def validate_edumind_apps(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="edumind_apps",
            item_max_length=120,
            max_items=20,
        )

    @field_validator("external_resource_refs")
    @classmethod
    def validate_external_resource_refs(cls, value: List[str]) -> List[str]:
        return _normalize_text_list(
            value,
            field_name="external_resource_refs",
            item_max_length=300,
            max_items=30,
        )

    @field_validator("linked_resource_ids")
    @classmethod
    def validate_linked_resource_ids(cls, value: List[int]) -> List[int]:
        return _normalize_positive_int_list(value, field_name="linked_resource_ids", max_items=20)


class PlannerSequenceGenerateResponse(BaseModel):
    persisted: bool
    schedule_based: bool
    class_name: str
    planning_resource_id: Optional[int] = None
    planning_resource_title: Optional[str] = None
    warnings: List[str]
    occupied_slots: List[str]
    planning_summary: str
    sessions: List[PlannerGeneratedSessionResponse]
    created_entries: List[PlannerEntryResponse] = Field(default_factory=list)


# ============================================
# PRINT DOCUMENT SCHEMA
# ============================================

class ClassStudentListResponse(BaseModel):
    """Datos para generar documento imprimible de asignación de nombres"""
    class_name: str
    course: str
    group: str
    subject: str
    academic_year: str
    students: List[StudentCodeResponse]
