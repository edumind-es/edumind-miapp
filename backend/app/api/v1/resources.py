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
Resources API - Teacher Premium Only
Gestión de recursos generados por IA y vinculación a clases
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
import json

from app.db import get_session
from app.models import (
    User, GeneratedResource, ResourceLink, TeacherClass, ResourceType
)
from app.schemas_classroom import (
    ResourceSaveRequest, ResourceResponse, ResourceLinkRequest
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


def _get_owned_resource_or_404(db: Session, resource_id: int, user_id: int) -> GeneratedResource:
    resource = db.get(GeneratedResource, resource_id)
    if not resource or resource.user_id != user_id:
        raise HTTPException(status_code=404, detail="Recurso no encontrado")
    return resource


# ============================================
# RESOURCE ENDPOINTS
# ============================================

@router.get("/", response_model=List[ResourceResponse])
def get_resources(
    resource_type: Optional[ResourceType] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Listar recursos guardados del usuario"""
    statement = select(GeneratedResource).where(
        GeneratedResource.user_id == user.id
    )
    
    if resource_type:
        statement = statement.where(GeneratedResource.resource_type == resource_type)
    
    statement = statement.order_by(GeneratedResource.created_at.desc())
    statement = statement.offset(offset).limit(limit)
    
    return db.exec(statement).all()


@router.post("/", response_model=ResourceResponse, status_code=201)
def save_resource(
    data: ResourceSaveRequest,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Guardar recurso generado por IA"""
    params_str = json.dumps(data.generation_params) if data.generation_params else None
    teacher_class = None
    if data.link_to_class_id:
        teacher_class = _get_owned_class_or_404(db, data.link_to_class_id, user.id)

    resource = GeneratedResource(
        user_id=user.id,
        resource_type=data.resource_type,
        title=data.title,
        content=data.content,
        generation_params=params_str
    )

    try:
        db.add(resource)
        db.flush()

        if teacher_class is not None:
            db.add(
                ResourceLink(
                    resource_id=resource.id,
                    class_id=teacher_class.id,
                )
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(resource)
    return resource


@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener detalles de un recurso"""
    return _get_owned_resource_or_404(db, resource_id, user.id)


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    resource_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Eliminar recurso y sus links"""
    resource = _get_owned_resource_or_404(db, resource_id, user.id)
    links_stmt = select(ResourceLink).where(ResourceLink.resource_id == resource_id)
    links = db.exec(links_stmt).all()
    for link in links:
        db.delete(link)
    
    db.delete(resource)
    db.commit()


# ============================================
# RESOURCE LINK ENDPOINTS
# ============================================

@router.post("/{resource_id}/link", status_code=201)
def link_resource_to_class(
    resource_id: int,
    data: ResourceLinkRequest,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Vincular recurso a una clase"""
    _get_owned_resource_or_404(db, resource_id, user.id)
    _get_owned_class_or_404(db, data.class_id, user.id)

    existing = db.exec(
        select(ResourceLink).where(
            ResourceLink.resource_id == resource_id,
            ResourceLink.class_id == data.class_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=409, detail="El recurso ya está vinculado a esta clase")
    
    link = ResourceLink(
        resource_id=resource_id,
        class_id=data.class_id,
        assigned_date=data.assigned_date,
        notes=data.notes
    )
    db.add(link)
    db.commit()
    
    return {"message": "Recurso vinculado correctamente"}


@router.delete("/{resource_id}/link/{class_id}", status_code=204)
def unlink_resource_from_class(
    resource_id: int,
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Desvincular recurso de una clase"""
    _get_owned_resource_or_404(db, resource_id, user.id)
    link = db.exec(
        select(ResourceLink).where(
            ResourceLink.resource_id == resource_id,
            ResourceLink.class_id == class_id
        )
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Vinculación no encontrada")
    
    db.delete(link)
    db.commit()


@router.get("/by-class/{class_id}", response_model=List[ResourceResponse])
def get_resources_by_class(
    class_id: int,
    user: User = Depends(require_teacher_premium),
    db: Session = Depends(get_session)
):
    """Obtener recursos vinculados a una clase"""
    _get_owned_class_or_404(db, class_id, user.id)
    statement = (
        select(GeneratedResource)
        .join(ResourceLink, ResourceLink.resource_id == GeneratedResource.id)
        .where(
            ResourceLink.class_id == class_id,
            GeneratedResource.user_id == user.id,
        )
        .order_by(GeneratedResource.created_at.desc())
    )
    
    return db.exec(statement).all()
