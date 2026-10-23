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
Classroom Management API - Teacher Premium Only
Gestión de clases, horarios y alumnado anonimizado
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List

from app.db import get_session
from app.models import (
    User, TeacherClass, ClassSchedule, StudentCode
)
from app.schemas_classroom import (
    TeacherClassCreate, TeacherClassUpdate, TeacherClassResponse,
    ClassScheduleCreate, ClassScheduleResponse,
    StudentCodeResponse, StudentNoteUpdate, ClassStudentListResponse
)
from app.api.v1.auth import get_current_user

router = APIRouter()


def require_teacher_premium(current_user: User = Depends(get_current_user)) -> User:
    """Verificar que el usuario está autenticado (cualquier rol registrado via SSO)"""
    return current_user


def _get_owned_class_or_404(db: Session, class_id: int, user_id: int) -> TeacherClass:
    teacher_class = db.get(TeacherClass, class_id)
    if not teacher_class or teacher_class.user_id != user_id:
        raise HTTPException(status_code=404, detail="Clase no encontrada")
    return teacher_class


def _find_duplicate_class(
    db: Session,
    *,
    user_id: int,
    course: str,
    group: str,
    subject: str,
    academic_year: str,
    exclude_class_id: int | None = None,
):
    statement = select(TeacherClass).where(
        TeacherClass.user_id == user_id,
        TeacherClass.course == course,
        TeacherClass.group == group,
        TeacherClass.subject == subject,
        TeacherClass.academic_year == academic_year,
        TeacherClass.is_active == True,
    )
    candidates = db.exec(statement).all()
    for candidate in candidates:
        if exclude_class_id is None or candidate.id != exclude_class_id:
            return candidate
    return None


def _sync_student_codes(db: Session, teacher_class: TeacherClass, target_count: int):
    students = db.exec(
        select(StudentCode).where(StudentCode.class_id == teacher_class.id).order_by(StudentCode.number)
    ).all()
    existing_by_number = {student.number: student for student in students}

    removable = [student for student in students if student.number > target_count]
    if removable and any((student.notes or "").strip() for student in removable):
        raise HTTPException(
            status_code=409,
            detail="No se puede reducir el número de alumnos porque existen notas en los códigos a eliminar.",
        )

    for student in removable:
        db.delete(student)

    for number in range(1, target_count + 1):
        if number not in existing_by_number:
            db.add(
                StudentCode(
                    class_id=teacher_class.id,
                    code=f"A{number:02d}",
                    number=number,
                )
            )

    teacher_class.student_count = target_count


def _has_schedule_overlap(
    db: Session,
    *,
    class_id: int,
    day_of_week: int,
    start_time: str,
    end_time: str,
) -> bool:
    existing_slots = db.exec(
        select(ClassSchedule).where(
            ClassSchedule.class_id == class_id,
            ClassSchedule.day_of_week == day_of_week,
        )
    ).all()
    return any(start_time < slot.end_time and end_time > slot.start_time for slot in existing_slots)


# ============================================
# TEACHER CLASS ENDPOINTS
# ============================================

@router.get("/classes", response_model=List[TeacherClassResponse])
def get_classes(
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Listar todas las clases del docente"""
    statement = select(TeacherClass).where(
        TeacherClass.user_id == user.id,
        TeacherClass.is_active == True
    )
    return db.exec(statement).all()


@router.post("/classes", response_model=TeacherClassResponse, status_code=201)
def create_class(
    data: TeacherClassCreate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Crear nueva clase y generar códigos de alumnos automáticamente"""
    duplicate = _find_duplicate_class(
        db,
        user_id=user.id,
        course=data.course,
        group=data.group,
        subject=data.subject,
        academic_year=data.academic_year,
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una clase activa con esos datos.")

    name = f"{data.course} {data.group}"
    teacher_class = TeacherClass(
        user_id=user.id,
        name=name,
        course=data.course,
        group=data.group,
        subject=data.subject,
        academic_year=data.academic_year,
        student_count=data.student_count,
        color=data.color or "#3B82F6"
    )

    try:
        db.add(teacher_class)
        db.flush()
        _sync_student_codes(db, teacher_class, data.student_count)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(teacher_class)
    return teacher_class


@router.get("/classes/{class_id}", response_model=TeacherClassResponse)
def get_class(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener detalles de una clase"""
    return _get_owned_class_or_404(db, class_id, user.id)


@router.put("/classes/{class_id}", response_model=TeacherClassResponse)
def update_class(
    class_id: int,
    data: TeacherClassUpdate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Actualizar clase"""
    teacher_class = _get_owned_class_or_404(db, class_id, user.id)
    update_data = data.model_dump(exclude_unset=True)

    next_course = update_data.get("course", teacher_class.course)
    next_group = update_data.get("group", teacher_class.group)
    next_subject = update_data.get("subject", teacher_class.subject)
    next_academic_year = update_data.get("academic_year", teacher_class.academic_year)

    duplicate = _find_duplicate_class(
        db,
        user_id=user.id,
        course=next_course,
        group=next_group,
        subject=next_subject,
        academic_year=next_academic_year,
        exclude_class_id=teacher_class.id,
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una clase activa con esos datos.")

    target_student_count = update_data.pop("student_count", None)

    for key, value in update_data.items():
        setattr(teacher_class, key, value)

    teacher_class.name = f"{next_course} {next_group}"

    try:
        if target_student_count is not None:
            _sync_student_codes(db, teacher_class, target_student_count)
        db.add(teacher_class)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(teacher_class)
    return teacher_class


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Desactivar clase (soft delete)"""
    teacher_class = _get_owned_class_or_404(db, class_id, user.id)
    teacher_class.is_active = False
    db.add(teacher_class)
    db.commit()


# ============================================
# CLASS SCHEDULE ENDPOINTS
# ============================================

@router.get("/classes/{class_id}/schedule", response_model=List[ClassScheduleResponse])
def get_schedule(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener horario de una clase"""
    _get_owned_class_or_404(db, class_id, user.id)
    statement = select(ClassSchedule).where(ClassSchedule.class_id == class_id)
    return db.exec(statement).all()


@router.post("/classes/{class_id}/schedule", response_model=ClassScheduleResponse, status_code=201)
def add_schedule_slot(
    class_id: int,
    data: ClassScheduleCreate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Añadir slot de horario a una clase"""
    _get_owned_class_or_404(db, class_id, user.id)
    if _has_schedule_overlap(
        db,
        class_id=class_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
    ):
        raise HTTPException(
            status_code=409,
            detail="El horario se solapa con otro slot existente para ese día.",
        )

    schedule = ClassSchedule(
        class_id=class_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.delete("/classes/{class_id}/schedule/{schedule_id}", status_code=204)
def delete_schedule_slot(
    class_id: int,
    schedule_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Eliminar slot de horario"""
    _get_owned_class_or_404(db, class_id, user.id)
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule or schedule.class_id != class_id:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    
    db.delete(schedule)
    db.commit()


# ============================================
# STUDENT CODE ENDPOINTS
# ============================================

@router.get("/classes/{class_id}/students", response_model=List[StudentCodeResponse])
def get_students(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener lista de códigos de alumnos"""
    _get_owned_class_or_404(db, class_id, user.id)
    statement = select(StudentCode).where(
        StudentCode.class_id == class_id
    ).order_by(StudentCode.number)
    return db.exec(statement).all()


@router.patch("/classes/{class_id}/students/{student_id}", response_model=StudentCodeResponse)
def update_student_note(
    class_id: int,
    student_id: int,
    data: StudentNoteUpdate,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Actualizar notas de un alumno"""
    _get_owned_class_or_404(db, class_id, user.id)
    student = db.get(StudentCode, student_id)
    if not student or student.class_id != class_id:
        raise HTTPException(status_code=404, detail="Alumno no encontrado")
    
    student.notes = data.notes
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/classes/{class_id}/print-list", response_model=ClassStudentListResponse)
def get_printable_student_list(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener datos para documento imprimible de asignación de nombres"""
    teacher_class = _get_owned_class_or_404(db, class_id, user.id)
    statement = select(StudentCode).where(
        StudentCode.class_id == class_id
    ).order_by(StudentCode.number)
    students = db.exec(statement).all()
    
    return ClassStudentListResponse(
        class_name=teacher_class.name,
        course=teacher_class.course,
        group=teacher_class.group,
        subject=teacher_class.subject,
        academic_year=teacher_class.academic_year,
        students=students
    )
