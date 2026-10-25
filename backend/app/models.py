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

from datetime import datetime, date
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    TEACHER_PREMIUM = "teacher_premium"  # Acceso a gestión de clases
    DOCENTE = "docente"
    OPOSITOR = "opositor"
    CENTRO = "centro"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: Optional[str] = Field(default=None, index=True)
    role: UserRole = Field(default=UserRole.DOCENTE)
    auth_provider: str = Field(default="local", index=True)
    oidc_subject: Optional[str] = Field(default=None, index=True, unique=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    api_keys: List["ApiKey"] = Relationship(back_populates="user")
    training_items: List["TrainingItem"] = Relationship(
        back_populates="creator",
        sa_relationship_kwargs={"foreign_keys": "TrainingItem.creator_id"}
    )

class ApiKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    engine: str = Field(index=True)  # chatgpt, claude, gemini, etc.
    encrypted_key: str
    is_active: bool = Field(default=True)
    label: Optional[str] = None
    last_used: Optional[datetime] = None
    
    user: User = Relationship(back_populates="api_keys")

class TrainingItemSource(str, Enum):
    CHAT = "chat_log"
    PDF = "pdf_extract"
    MANUAL = "manual"

class TrainingItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    instruction: str  # The prompt
    output: str       # The completion
    source: TrainingItemSource
    
    # Metadata for curation
    quality_score: int = Field(default=0) # 1-5
    is_verified: bool = Field(default=False)
    verified_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    creator_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    creator: Optional[User] = Relationship(
        back_populates="training_items",
        sa_relationship_kwargs={"foreign_keys": "TrainingItem.creator_id"}
    )

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    file_path: str
    file_type: str = Field(default="unknown")  # pdf, xlsx, docx, pptx, md, json, png
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    processed: bool = Field(default=False)
    uploader_id: Optional[int] = Field(default=None, foreign_key="user.id")
    processing_status: str = Field(default="uploaded", index=True)
    processing_started_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    parse_error: Optional[str] = None


class TrainingJobStatus(str, Enum):
    PREPARING = "preparing"
    READY = "ready"
    QUEUED = "queued"
    TRAINING = "training"
    COMPLETED = "completed"
    FAILED = "failed"


class TrainingJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    version: str  # "edumind-v1.0", "edumind-v1.1"
    status: TrainingJobStatus = Field(default=TrainingJobStatus.PREPARING)
    dataset_path: Optional[str] = None
    model_path: Optional[str] = None
    example_count: int = Field(default=0)
    epochs: int = Field(default=3)
    learning_rate: float = Field(default=2e-4)
    base_model: str = Field(default="mistralai/Mistral-7B-v0.1")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")


class ActivityLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    action: str  # "generate_stem", "upload_file", "train_start", "login"
    resource_type: Optional[str] = None  # "training_item", "document", "training_job"
    resource_id: Optional[int] = None
    details: Optional[str] = None  # JSON string with extra info
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SystemConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AppFeedback(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    content: str
    rating: int = Field(default=5) # 1-5 stars
    context: Optional[str] = None # "chat_export", "logout", etc.
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BackgroundTaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundTaskJob(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_type: str = Field(index=True)
    status: BackgroundTaskStatus = Field(default=BackgroundTaskStatus.QUEUED, index=True)
    dedupe_key: Optional[str] = Field(default=None, index=True)
    payload: str
    attempts: int = Field(default=0)
    max_attempts: int = Field(default=3)
    available_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_error: Optional[str] = None
    result: Optional[str] = None
    worker_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================
# GESTIÓN DE CLASES (Teacher Premium)
# ============================================

class TeacherClass(SQLModel, table=True):
    """Clase/grupo del docente (ej: 3º ESO A, 6º Primaria B)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str  # "3º ESO A"
    course: str  # "3º ESO"
    group: str  # "A", "B"
    subject: str  # "Educación Física"
    academic_year: str  # "2025-2026"
    student_count: int = Field(default=0)
    color: str = Field(default="#3B82F6")  # Para visualización en planner
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ClassSchedule(SQLModel, table=True):
    """Horario semanal de una clase"""
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="teacherclass.id", index=True)
    day_of_week: int  # 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes
    start_time: str  # "09:00"
    end_time: str  # "09:55"
    room: Optional[str] = None


class StudentCode(SQLModel, table=True):
    """Código de alumno anónimo - asociación en papel por docente"""
    id: Optional[int] = Field(default=None, primary_key=True)
    class_id: int = Field(foreign_key="teacherclass.id", index=True)
    code: str  # "A01", "A02", ... auto-generado
    number: int  # Número ordinal del alumno (1, 2, 3...)
    notes: Optional[str] = None  # Notas privadas del docente
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeacherProfile(SQLModel, table=True):
    """Perfil pedagógico del docente: solo preferencias de trabajo, nunca datos personales.

    Sirve para prellenar comunidad, etapa, curso y matriz curricular en las herramientas
    y para dar contexto estable a los generadores. Se borra con la cuenta.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True, unique=True)
    comunidad_key: Optional[str] = None  # p. ej. "galicia"
    etapa_key: Optional[str] = None  # infantil | primaria | secundaria
    area_key: Optional[str] = None  # p. ej. "educacion-fisica"
    curso: Optional[str] = None  # p. ej. "5.º de Primaria"
    matriz_id: Optional[str] = None  # comunidad/etapa/area/nivel de la última matriz preferida
    metodologia_slider: Optional[int] = None  # 0-100 (tradicional ↔ innovador)
    tipo_agrupamiento: Optional[str] = None
    contexto_aula: Optional[str] = None  # texto breve y anonimizado sobre el aula o el centro
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ResourceType(str, Enum):
    RUBRIC = "rubric"
    SESSION = "session"
    PLANNING = "planning"
    WORKSHEET = "worksheet"
    SITUATION = "situation"
    OTHER = "other"


class GeneratedResource(SQLModel, table=True):
    """Recurso generado por IA y guardado por teacher_premium"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    resource_type: ResourceType
    title: str
    content: str  # Contenido generado (Markdown/HTML)
    generation_params: Optional[str] = None  # JSON con parámetros de generación
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResourceLink(SQLModel, table=True):
    """Vinculación de recurso IA a una clase"""
    id: Optional[int] = Field(default=None, primary_key=True)
    resource_id: int = Field(foreign_key="generatedresource.id", index=True)
    class_id: int = Field(foreign_key="teacherclass.id", index=True)
    assigned_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PlannerEntryStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PlannerEntry(SQLModel, table=True):
    """Entrada en el planner semanal del docente"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    class_id: int = Field(foreign_key="teacherclass.id", index=True)
    entry_date: date
    start_time: str  # "09:00"
    end_time: str  # "09:55"
    title: str
    description: Optional[str] = None
    resource_id: Optional[int] = Field(default=None, foreign_key="generatedresource.id")
    status: PlannerEntryStatus = Field(default=PlannerEntryStatus.PLANNED)
    color: Optional[str] = None  # Override del color de clase
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
