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

"""
Weekly Planner API - Teacher Premium Only
Gestión del planner semanal con entradas vinculadas a clases y recursos
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List
from datetime import date, timedelta, datetime

from app.db import get_session
from app.models import (
    User,
    PlannerEntry,
    TeacherClass,
    PlannerEntryStatus,
    GeneratedResource,
    ResourceLink,
    ClassSchedule,
    ResourceType,
)
from app.schemas_classroom import (
    PlannerEntryCreate,
    PlannerEntryUpdate,
    PlannerEntryResponse,
    PlannerGeneratedSessionResponse,
    PlannerSequenceGenerateRequest,
    PlannerSequenceGenerateResponse,
)
from app.api.v1.auth import get_current_user

router = APIRouter()

_DAY_LABELS = {
    0: "Lunes",
    1: "Martes",
    2: "Miércoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sábado",
    6: "Domingo",
}

_EDUMIND_APP_LABELS = {
    "edumind_quiz": "EDUmind Quiz",
    "edumind_motion": "EDUmind Motion",
    "edumind_pasos": "EDUmind Pasos",
    "edumind_robotics": "EDUmind Robotics",
    "edumind_geobreath": "EDUmind Geobreath",
    "liga_de_valores": "Liga de Valores",
    "moodle": "Moodle",
}


def _methodology_summary(slider: int, notes: str | None) -> str:
    if slider <= 33:
        band = "Enfoque guiado y estructurado"
    elif slider <= 66:
        band = "Enfoque equilibrado entre guía docente y metodologías activas"
    else:
        band = "Enfoque activo, competencial e innovador"
    if notes:
        return f"{band}. {notes}"
    return band


def _phase_label(session_number: int, total_sessions: int) -> str:
    if total_sessions == 1:
        return "Sesión competencial integrada"
    if session_number == 1:
        return "Activación y diagnóstico"
    if session_number == total_sessions:
        return "Síntesis, transferencia y evaluación"

    middle_cycle = [
        "Exploración guiada",
        "Desarrollo competencial",
        "Aplicación práctica",
        "Consolidación y feedback",
    ]
    return middle_cycle[(session_number - 2) % len(middle_cycle)]


def _distribute_items(items: list[str], total_sessions: int) -> list[list[str]]:
    buckets = [[] for _ in range(total_sessions)]
    if not items:
        return buckets

    for index, item in enumerate(items):
        buckets[index % total_sessions].append(item)

    for index in range(total_sessions):
        if not buckets[index]:
            buckets[index].append(items[min(index, len(items) - 1)])
    return buckets


def _infer_stage_from_course(course: str) -> str:
    normalized = (course or "").lower()
    if "primaria" in normalized:
        return "Educación Primaria"
    if "infantil" in normalized:
        return "Educación Infantil"
    if "eso" in normalized:
        return "Educación Secundaria Obligatoria"
    if "bach" in normalized:
        return "Bachillerato"
    if "fp" in normalized:
        return "Formación Profesional"
    return "Etapa educativa por concretar"


def _build_session_slots(
    schedules: list[ClassSchedule],
    *,
    start_date: date,
    session_count: int,
) -> tuple[list[dict], bool]:
    sorted_schedules = sorted(schedules, key=lambda slot: (slot.day_of_week, slot.start_time))
    slots: list[dict] = []
    schedule_based = bool(sorted_schedules)

    cursor = start_date
    attempts = 0
    max_days = max(session_count * 14, 30)

    while len(slots) < session_count and attempts < max_days:
        weekday = cursor.weekday()
        if sorted_schedules:
            matched_slots = [slot for slot in sorted_schedules if slot.day_of_week == weekday]
            for schedule in matched_slots:
                slots.append(
                    {
                        "entry_date": cursor,
                        "start_time": schedule.start_time,
                        "end_time": schedule.end_time,
                        "room": schedule.room,
                    }
                )
                if len(slots) >= session_count:
                    break
        elif weekday < 5:
            slots.append(
                {
                    "entry_date": cursor,
                    "start_time": "09:00",
                    "end_time": "09:55",
                    "room": None,
                }
            )

        cursor += timedelta(days=1)
        attempts += 1

    if len(slots) < session_count:
        raise HTTPException(
            status_code=422,
            detail="No se pudieron calcular suficientes sesiones con el horario y la fecha de inicio indicados.",
        )

    return slots[:session_count], schedule_based


def _build_resource_labels(
    *,
    linked_resources: list[GeneratedResource],
    edumind_resource_refs: list[str],
    web_resources: list[str],
    external_resource_refs: list[str],
    edumind_apps: list[str],
) -> list[str]:
    combined = []
    combined.extend([f"Recurso vinculado: {resource.title}" for resource in linked_resources])
    combined.extend([f"EDUmind Recursos: {item}" for item in edumind_resource_refs])
    combined.extend([f"Web: {item}" for item in web_resources])
    combined.extend([f"Multiformato: {item}" for item in external_resource_refs])
    combined.extend(
        [f"App EDUmind: {_EDUMIND_APP_LABELS.get(app, app)}" for app in edumind_apps]
    )
    deduped: list[str] = []
    seen: set[str] = set()
    for item in combined:
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _build_session_focus(
    *,
    sequence_title: str,
    phase_label: str,
    session_number: int,
    total_sessions: int,
) -> str:
    if total_sessions == 1:
        return f"Desarrollar una sesión completa y coherente sobre {sequence_title}."
    if session_number == 1:
        return f"Activar conocimientos previos y contextualizar la secuencia sobre {sequence_title}."
    if session_number == total_sessions:
        return f"Sintetizar aprendizajes, transferir y evaluar el trabajo sobre {sequence_title}."
    return f"Avanzar en la secuencia '{sequence_title}' mediante la fase: {phase_label.lower()}."


def _build_session_description(
    *,
    teacher_class: TeacherClass,
    area: str,
    stage: str,
    phase_label: str,
    focus: str,
    criteria: list[str],
    contents: list[str],
    methodology: str,
    dua_diversity: str | None,
    resources: list[str],
    additional_proposals: str | None,
) -> str:
    sections = [
        f"Curso y grupo: {teacher_class.course} {teacher_class.group}",
        f"Área: {area}",
        f"Etapa: {stage}",
        f"Fase: {phase_label}",
        f"Foco: {focus}",
        f"Criterios de evaluación: {'; '.join(criteria)}",
        f"Contenidos asociados: {'; '.join(contents)}",
        f"Metodología: {methodology}",
    ]
    if dua_diversity:
        sections.append(f"DUA y atención a la diversidad: {dua_diversity}")
    if resources:
        sections.append(f"Recursos previstos: {'; '.join(resources)}")
    if additional_proposals:
        sections.append(f"Propuestas adicionales: {additional_proposals}")
    return "\n".join(sections)


def _build_planning_summary(
    *,
    teacher_class: TeacherClass,
    area: str,
    stage: str,
    sequence_title: str,
    methodology: str,
    criteria: list[str],
    contents: list[str],
    dua_diversity: str | None,
    additional_proposals: str | None,
    shared_resources: list[str],
    sessions: list[PlannerGeneratedSessionResponse],
) -> str:
    lines = [
        f"Planificación semanal: {sequence_title}",
        "",
        f"Clase: {teacher_class.name}",
        f"Curso: {teacher_class.course}",
        f"Grupo: {teacher_class.group}",
        f"Área: {area}",
        f"Etapa: {stage}",
        f"Metodología global: {methodology}",
        f"Criterios de evaluación: {'; '.join(criteria)}",
        f"Contenidos asociados: {'; '.join(contents)}",
    ]
    if dua_diversity:
        lines.append(f"DUA y atención a la diversidad: {dua_diversity}")
    if additional_proposals:
        lines.append(f"Propuestas adicionales: {additional_proposals}")
    if shared_resources:
        lines.append(f"Recursos globales: {'; '.join(shared_resources)}")

    lines.extend(["", "Secuencia de sesiones:"])
    for session in sessions:
        lines.extend(
            [
                "",
                f"Sesión {session.session_number} | {session.day_label} {session.entry_date} | {session.start_time}-{session.end_time}",
                f"Título: {session.title}",
                f"Foco: {session.focus}",
                f"Criterios: {'; '.join(session.criteria)}",
                f"Contenidos: {'; '.join(session.contents)}",
                f"Metodología: {session.methodology}",
                f"Recursos: {'; '.join(session.resources) if session.resources else 'Sin recursos específicos'}",
            ]
        )
    return "\n".join(lines)


def require_teacher_premium(current_user: User = Depends(get_current_user)) -> User:
    """Verificar que el usuario está autenticado (cualquier rol registrado via SSO)"""
    return current_user


def _get_owned_class_or_404(db: Session, class_id: int, user_id: int) -> TeacherClass:
    teacher_class = db.get(TeacherClass, class_id)
    if not teacher_class or teacher_class.user_id != user_id:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    return teacher_class


def _get_owned_entry_or_404(db: Session, entry_id: int, user_id: int) -> PlannerEntry:
    entry = db.get(PlannerEntry, entry_id)
    if not entry or entry.user_id != user_id:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    return entry


def _ensure_owned_resource(db: Session, resource_id: int | None, user_id: int):
    if resource_id is None:
        return None
    resource = db.get(GeneratedResource, resource_id)
    if not resource or resource.user_id != user_id:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return resource


def _find_duplicate_entry(
    db: Session,
    *,
    user_id: int,
    class_id: int,
    entry_date: date,
    start_time: str,
    exclude_entry_id: int | None = None,
):
    statement = select(PlannerEntry).where(
        PlannerEntry.user_id == user_id,
        PlannerEntry.class_id == class_id,
        PlannerEntry.entry_date == entry_date,
        PlannerEntry.start_time == start_time,
    )
    entries = db.exec(statement).all()
    for entry in entries:
        if exclude_entry_id is None or entry.id != exclude_entry_id:
            return entry
    return None


# ============================================
# PLANNER ENDPOINTS
# ============================================

@router.get("/week", response_model=List[PlannerEntryResponse])
def get_week_planner(
    start_date: date = Query(..., description="Lunes de la semana"),
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener entradas del planner para una semana completa"""
    end_date = start_date + timedelta(days=6)  # Domingo
    
    statement = select(PlannerEntry).where(
        PlannerEntry.user_id == user.id,
        PlannerEntry.entry_date >= start_date,
        PlannerEntry.entry_date <= end_date
    ).order_by(PlannerEntry.entry_date, PlannerEntry.start_time)
    
    return db.exec(statement).all()


@router.get("/day", response_model=List[PlannerEntryResponse])
def get_day_planner(
    day: date = Query(..., description="Fecha del día"),
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener entradas del planner para un día específico"""
    statement = select(PlannerEntry).where(
        PlannerEntry.user_id == user.id,
        PlannerEntry.entry_date == day
    ).order_by(PlannerEntry.start_time)
    
    return db.exec(statement).all()


@router.post("/entries", response_model=PlannerEntryResponse, status_code=201)
def create_planner_entry(
    data: PlannerEntryCreate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Crear nueva entrada en el planner"""
    teacher_class = _get_owned_class_or_404(db, data.class_id, user.id)
    _ensure_owned_resource(db, data.resource_id, user.id)
    if _find_duplicate_entry(
        db,
        user_id=user.id,
        class_id=data.class_id,
        entry_date=data.entry_date,
        start_time=data.start_time,
    ):
        raise HTTPException(
            status_code=409,
            detail="Ya existe una entrada para esa clase, fecha y hora de inicio.",
        )

    entry = PlannerEntry(
        user_id=user.id,
        class_id=data.class_id,
        entry_date=data.entry_date,
        start_time=data.start_time,
        end_time=data.end_time,
        title=data.title,
        description=data.description,
        resource_id=data.resource_id,
        color=data.color or teacher_class.color
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/entries/{entry_id}", response_model=PlannerEntryResponse)
def get_planner_entry(
    entry_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener detalles de una entrada del planner"""
    return _get_owned_entry_or_404(db, entry_id, user.id)


@router.put("/entries/{entry_id}", response_model=PlannerEntryResponse)
def update_planner_entry(
    entry_id: int,
    data: PlannerEntryUpdate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Actualizar entrada del planner"""
    entry = _get_owned_entry_or_404(db, entry_id, user.id)
    update_data = data.model_dump(exclude_unset=True)
    if "resource_id" in update_data and update_data["resource_id"] is not None:
        _ensure_owned_resource(db, update_data["resource_id"], user.id)

    for key, value in update_data.items():
        setattr(entry, key, value)
    
    from datetime import datetime
    entry.updated_at = datetime.utcnow()
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}/status", response_model=PlannerEntryResponse)
def update_entry_status(
    entry_id: int,
    status: PlannerEntryStatus,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Cambiar estado de una entrada"""
    entry = _get_owned_entry_or_404(db, entry_id, user.id)
    entry.status = status
    from datetime import datetime
    entry.updated_at = datetime.utcnow()
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_planner_entry(
    entry_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Eliminar entrada del planner"""
    entry = _get_owned_entry_or_404(db, entry_id, user.id)
    db.delete(entry)
    db.commit()


@router.post("/entries/from-schedule", response_model=List[PlannerEntryResponse])
def create_entries_from_schedule(
    start_date: date = Query(..., description="Fecha de inicio"),
    weeks: int = Query(1, ge=1, le=12, description="Número de semanas"),
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """
    Generar entradas del planner basadas en el horario de clases.
    Útil para pre-poblar el planner con las clases programadas.
    """
    from app.models import ClassSchedule
    
    # Obtener todas las clases del usuario
    classes_stmt = select(TeacherClass).where(
        TeacherClass.user_id == user.id,
        TeacherClass.is_active == True
    )
    classes = {c.id: c for c in db.exec(classes_stmt).all()}
    
    # Obtener horarios
    class_ids = list(classes.keys())
    if not class_ids:
        return []
    
    schedules_stmt = select(ClassSchedule).where(
        ClassSchedule.class_id.in_(class_ids)
    )
    schedules = db.exec(schedules_stmt).all()
    
    created_entries = []
    
    for week in range(weeks):
        week_start = start_date + timedelta(weeks=week)
        
        for schedule in schedules:
            entry_date = week_start + timedelta(days=schedule.day_of_week)
            teacher_class = classes[schedule.class_id]
            
            # Verificar si ya existe entrada para este slot
            existing = db.exec(
                select(PlannerEntry).where(
                    PlannerEntry.user_id == user.id,
                    PlannerEntry.class_id == schedule.class_id,
                    PlannerEntry.entry_date == entry_date,
                    PlannerEntry.start_time == schedule.start_time
                )
            ).first()
            
            if not existing:
                entry = PlannerEntry(
                    user_id=user.id,
                    class_id=schedule.class_id,
                    entry_date=entry_date,
                    start_time=schedule.start_time,
                    end_time=schedule.end_time,
                    title=teacher_class.name,
                    color=teacher_class.color
                )
                db.add(entry)
                created_entries.append(entry)
    
    db.commit()
    for entry in created_entries:
        db.refresh(entry)
    
    return created_entries


@router.post("/entries/generate-sequence", response_model=PlannerSequenceGenerateResponse)
def generate_planner_sequence(
    data: PlannerSequenceGenerateRequest,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session),
):
    teacher_class = _get_owned_class_or_404(db, data.class_id, user.id)

    linked_resources: list[GeneratedResource] = []
    for resource_id in data.linked_resource_ids:
        linked_resources.append(_ensure_owned_resource(db, resource_id, user.id))

    schedules = db.exec(
        select(ClassSchedule).where(ClassSchedule.class_id == teacher_class.id)
    ).all()
    slots, schedule_based = _build_session_slots(
        schedules,
        start_date=data.start_date,
        session_count=data.session_count,
    )

    stage = data.stage or _infer_stage_from_course(teacher_class.course)
    methodology = _methodology_summary(data.methodology_slider, data.methodology_notes)
    shared_resources = _build_resource_labels(
        linked_resources=linked_resources,
        edumind_resource_refs=data.edumind_resource_refs,
        web_resources=data.web_resources,
        external_resource_refs=data.external_resource_refs,
        edumind_apps=data.edumind_apps,
    )

    criteria_by_session = _distribute_items(data.criteria, len(slots))
    contents_by_session = _distribute_items(data.contents, len(slots))
    resources_by_session = _distribute_items(shared_resources, len(slots))

    warnings: list[str] = []
    if not schedule_based:
        warnings.append(
            "La clase no tiene horario configurado; las fechas se han calculado en días lectivos consecutivos."
        )

    occupied_slots: list[str] = []
    sessions: list[PlannerGeneratedSessionResponse] = []
    for index, slot in enumerate(slots, start=1):
        existing = _find_duplicate_entry(
            db,
            user_id=user.id,
            class_id=teacher_class.id,
            entry_date=slot["entry_date"],
            start_time=slot["start_time"],
        )
        if existing:
            occupied_slots.append(f"{slot['entry_date']} {slot['start_time']}")

        phase_label = _phase_label(index, len(slots))
        focus = _build_session_focus(
            sequence_title=data.sequence_title,
            phase_label=phase_label,
            session_number=index,
            total_sessions=len(slots),
        )
        title = f"Sesión {index}. {phase_label} - {data.sequence_title}"
        description = _build_session_description(
            teacher_class=teacher_class,
            area=data.area,
            stage=stage,
            phase_label=phase_label,
            focus=focus,
            criteria=criteria_by_session[index - 1],
            contents=contents_by_session[index - 1],
            methodology=methodology,
            dua_diversity=data.dua_diversity,
            resources=resources_by_session[index - 1],
            additional_proposals=data.additional_proposals,
        )
        sessions.append(
            PlannerGeneratedSessionResponse(
                session_number=index,
                entry_date=slot["entry_date"],
                day_label=_DAY_LABELS[slot["entry_date"].weekday()],
                start_time=slot["start_time"],
                end_time=slot["end_time"],
                title=title,
                phase_label=phase_label,
                focus=focus,
                criteria=criteria_by_session[index - 1],
                contents=contents_by_session[index - 1],
                methodology=methodology,
                dua_diversity=data.dua_diversity,
                resources=resources_by_session[index - 1],
                description=description,
            )
        )

    if occupied_slots:
        warnings.append(
            "Ya existen entradas en algunos huecos del planner. Previsualiza antes de guardar para evitar duplicidades."
        )

    planning_summary = _build_planning_summary(
        teacher_class=teacher_class,
        area=data.area,
        stage=stage,
        sequence_title=data.sequence_title,
        methodology=methodology,
        criteria=data.criteria,
        contents=data.contents,
        dua_diversity=data.dua_diversity,
        additional_proposals=data.additional_proposals,
        shared_resources=shared_resources,
        sessions=sessions,
    )

    if not data.persist:
        return PlannerSequenceGenerateResponse(
            persisted=False,
            schedule_based=schedule_based,
            class_name=teacher_class.name,
            warnings=warnings,
            occupied_slots=occupied_slots,
            planning_summary=planning_summary,
            sessions=sessions,
        )

    if occupied_slots:
        raise HTTPException(
            status_code=409,
            detail=(
                "Ya existen entradas en los siguientes huecos del planner: "
                + ", ".join(occupied_slots[:6])
            ),
        )

    params_payload = {
        "sequence_title": data.sequence_title,
        "area": data.area,
        "stage": stage,
        "criteria": data.criteria,
        "contents": data.contents,
        "methodology_slider": data.methodology_slider,
        "methodology_notes": data.methodology_notes,
        "additional_proposals": data.additional_proposals,
        "dua_diversity": data.dua_diversity,
        "web_resources": data.web_resources,
        "edumind_resource_refs": data.edumind_resource_refs,
        "linked_resource_ids": data.linked_resource_ids,
        "edumind_apps": data.edumind_apps,
        "external_resource_refs": data.external_resource_refs,
        "session_count": data.session_count,
        "start_date": data.start_date.isoformat(),
    }

    planning_resource = GeneratedResource(
        user_id=user.id,
        resource_type=ResourceType.PLANNING,
        title=f"Planificación semanal · {data.sequence_title} · {teacher_class.name}",
        content=planning_summary,
        generation_params=json.dumps(params_payload, ensure_ascii=True),
    )

    created_entries: list[PlannerEntry] = []
    try:
        db.add(planning_resource)
        db.flush()

        db.add(
            ResourceLink(
                resource_id=planning_resource.id,
                class_id=teacher_class.id,
                assigned_date=data.start_date,
            )
        )

        for session in sessions:
            entry = PlannerEntry(
                user_id=user.id,
                class_id=teacher_class.id,
                entry_date=session.entry_date,
                start_time=session.start_time,
                end_time=session.end_time,
                title=session.title,
                description=session.description,
                resource_id=planning_resource.id,
                color=teacher_class.color,
                updated_at=datetime.utcnow(),
            )
            db.add(entry)
            created_entries.append(entry)

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(planning_resource)
    for entry in created_entries:
        db.refresh(entry)

    return PlannerSequenceGenerateResponse(
        persisted=True,
        schedule_based=schedule_based,
        class_name=teacher_class.name,
        planning_resource_id=planning_resource.id,
        planning_resource_title=planning_resource.title,
        warnings=warnings,
        occupied_slots=occupied_slots,
        planning_summary=planning_summary,
        sessions=sessions,
        created_entries=[PlannerEntryResponse.model_validate(entry) for entry in created_entries],
    )
