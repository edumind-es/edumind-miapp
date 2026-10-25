#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Perfil pedagógico del docente: una fila por usuario, solo preferencias de trabajo."""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.api.v1.auth import get_current_user
from app.db import get_session
from app.models import TeacherProfile, User
from app.schemas import TeacherProfileIn, TeacherProfileOut
from app.services.dataset_privacy import scrub_personal_data

router = APIRouter()

_KEY = re.compile(r"^[a-z0-9_-]{1,64}$")
_MATRIZ = re.compile(r"^[a-z0-9_-]+(/[a-z0-9_.-]+){3}$")
_AGRUPAMIENTOS = {"Individual", "Parejas", "Grupos pequeños (3-5)", "Grupos grandes (6+)", "Gran grupo", "Agrupamiento flexible"}


def _to_out(profile: TeacherProfile | None) -> TeacherProfileOut:
    if not profile:
        return TeacherProfileOut()
    return TeacherProfileOut(
        comunidad_key=profile.comunidad_key,
        etapa_key=profile.etapa_key,
        area_key=profile.area_key,
        curso=profile.curso,
        matriz_id=profile.matriz_id,
        metodologia_slider=profile.metodologia_slider,
        tipo_agrupamiento=profile.tipo_agrupamiento,
        contexto_aula=profile.contexto_aula,
        updated_at=profile.updated_at.isoformat() if profile.updated_at else None,
    )


def _validar(payload: TeacherProfileIn) -> TeacherProfileIn:
    for campo in ("comunidad_key", "etapa_key", "area_key"):
        valor = getattr(payload, campo)
        if valor is not None and not _KEY.match(valor):
            raise HTTPException(status_code=422, detail=f"{campo} no es una clave válida.")
    if payload.matriz_id is not None and not _MATRIZ.match(payload.matriz_id):
        raise HTTPException(status_code=422, detail="matriz_id no tiene el formato comunidad/etapa/area/nivel.")
    if payload.metodologia_slider is not None and not 0 <= payload.metodologia_slider <= 100:
        raise HTTPException(status_code=422, detail="metodologia_slider debe estar entre 0 y 100.")
    if payload.tipo_agrupamiento is not None and payload.tipo_agrupamiento not in _AGRUPAMIENTOS:
        raise HTTPException(status_code=422, detail="tipo_agrupamiento no reconocido.")
    if payload.curso is not None and len(payload.curso) > 60:
        raise HTTPException(status_code=422, detail="curso demasiado largo.")
    if payload.contexto_aula is not None:
        # Minimización: sin correos, teléfonos ni documentos; y acotado.
        limpio, _ = scrub_personal_data(payload.contexto_aula.strip())
        payload.contexto_aula = limpio[:600] or None
    return payload


@router.get("/me", response_model=TeacherProfileOut)
async def get_my_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    profile = session.exec(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)).first()
    return _to_out(profile)


@router.put("/me", response_model=TeacherProfileOut)
async def update_my_profile(
    payload: TeacherProfileIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    datos = _validar(payload)
    profile = session.exec(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)).first()
    if not profile:
        profile = TeacherProfile(user_id=current_user.id)
    for campo, valor in datos.model_dump().items():
        setattr(profile, campo, valor)
    profile.updated_at = datetime.utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _to_out(profile)


@router.delete("/me", status_code=204)
async def delete_my_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    profile = session.exec(select(TeacherProfile).where(TeacherProfile.user_id == current_user.id)).first()
    if profile:
        session.delete(profile)
        session.commit()
