#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""API de matrices curriculares LOMLOE (todas las comunidades, etapas y áreas)."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.curriculum_matrix_service import CurriculumMatrixService

router = APIRouter()


class CurriculumStatusResponse(BaseModel):
    loaded: bool
    index_path: str
    loaded_at: str | None
    generated_at: str | None
    version: int | None
    matrices: int
    comunidades: int
    criterios: int
    saberes: int
    last_error: str | None


class MatrizResumen(BaseModel):
    id: str
    comunidad: str
    comunidad_key: str
    etapa: str
    etapa_key: str
    area: str
    area_key: str
    nivel: str
    nivel_key: str
    idioma: str
    revisar: bool
    n_competencias: int
    n_criterios: int
    n_saberes: int


class NivelCatalogo(BaseModel):
    id: str
    nivel: str
    nivel_key: str
    idioma: str
    revisar: bool
    n_criterios: int
    n_saberes: int


class AreaCatalogo(BaseModel):
    area: str
    area_key: str
    niveles: list[NivelCatalogo]


class EtapaCatalogo(BaseModel):
    etapa: str
    etapa_key: str
    areas: list[AreaCatalogo]


class ComunidadCatalogo(BaseModel):
    comunidad: str
    comunidad_key: str
    etapas: list[EtapaCatalogo]


class CatalogoResponse(BaseModel):
    total: int
    comunidades: list[ComunidadCatalogo]


class ElementoCurricular(BaseModel):
    codigo: str = ""
    titulo: str
    enlaces: list[str] = []
    peso: str | None = None
    bloque: str | None = None


class BloqueSaberes(BaseModel):
    codigo: str
    titulo: str


class MatrizDetalle(MatrizResumen):
    archivo: str
    competencias_clave: list[ElementoCurricular]
    descriptores: list[ElementoCurricular]
    competencias_especificas: list[ElementoCurricular]
    criterios: list[ElementoCurricular]
    bloques: list[BloqueSaberes]
    saberes: list[ElementoCurricular]


class BusquedaHit(BaseModel):
    matriz_id: str
    comunidad: str
    etapa: str
    area: str
    nivel: str
    tipo: str
    codigo: str
    titulo: str
    score: float


class BusquedaResponse(BaseModel):
    query: str
    total: int
    results: list[BusquedaHit]


class ContextoRequest(BaseModel):
    id: str = Field(..., description="Identificador de la matriz (comunidad/etapa/area/nivel)")
    competencias: list[str] = []
    criterios: list[str] = []
    saberes: list[str] = []
    max_chars: int = Field(7000, ge=500, le=20000)


class ContextoResponse(BaseModel):
    matriz_id: str
    texto: str


def _requerir_indice() -> None:
    if not CurriculumMatrixService.load():
        raise HTTPException(status_code=503, detail=CurriculumMatrixService.get_status()["last_error"])


@router.get("/status", response_model=CurriculumStatusResponse)
async def get_curriculum_status():
    return CurriculumMatrixService.get_status()


@router.get("/catalogo", response_model=CatalogoResponse)
async def get_catalogo():
    """Árbol comunidad → etapa → área → niveles con el id de cada matriz."""
    _requerir_indice()
    return CurriculumMatrixService.get_catalogo()


@router.get("/matrices", response_model=list[MatrizResumen])
async def list_matrices(
    comunidad: str | None = Query(None, description="comunidad_key, p.ej. galicia"),
    etapa: str | None = Query(None, description="infantil | primaria | secundaria"),
    area: str | None = Query(None, description="area_key, p.ej. educacion-fisica"),
    incluir_revisar: bool = Query(True, description="Incluir matrices marcadas [REVISAR]"),
):
    _requerir_indice()
    return CurriculumMatrixService.list_matrices(comunidad, etapa, area, incluir_revisar)


@router.get("/buscar", response_model=BusquedaResponse)
async def buscar(
    q: str = Query(..., min_length=2, max_length=200, description="Texto a buscar en criterios y saberes"),
    comunidad: str | None = Query(None),
    etapa: str | None = Query(None),
    area: str | None = Query(None),
    tipo: str | None = Query(None, description="competencias_especificas | criterios | saberes"),
    limit: int = Query(20, ge=1, le=100),
):
    _requerir_indice()
    resultados = CurriculumMatrixService.search(q, comunidad, etapa, area, tipo, limit)
    return {"query": q, "total": len(resultados), "results": resultados}


@router.post("/contexto", response_model=ContextoResponse)
async def construir_contexto(payload: ContextoRequest):
    """Bloque de texto con los elementos oficiales seleccionados, listo para un prompt."""
    _requerir_indice()
    texto = CurriculumMatrixService.build_prompt_context(
        payload.id, payload.competencias, payload.criterios, payload.saberes, payload.max_chars
    )
    if not texto:
        raise HTTPException(status_code=404, detail="Matriz curricular no encontrada")
    return {"matriz_id": payload.id.strip().strip("/"), "texto": texto}


@router.get("/matrices/{matriz_id:path}", response_model=MatrizDetalle)
async def get_matriz(matriz_id: str) -> Any:
    _requerir_indice()
    matriz = CurriculumMatrixService.get_matriz(matriz_id)
    if not matriz:
        raise HTTPException(status_code=404, detail="Matriz curricular no encontrada")
    return {**CurriculumMatrixService.resumen(matriz), **matriz}
