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

"""Normative retrieval API with indexed backend search."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.v1.auth import require_admin_or_vpn
from app.services.galicia_curriculum_service import GaliciaCurriculumService
from app.services.normative_service import NormativeRetrievalService

router = APIRouter()


class NormativeSearchResult(BaseModel):
    document_id: str
    document_type: str
    category: str
    section_kind: str
    section_label: str
    title: str
    content: str
    score: float


class NormativeSearchResponse(BaseModel):
    query: str
    page: int
    page_size: int
    total_results: int
    total_pages: int
    cache_hit: bool
    results: list[NormativeSearchResult]
    context: str


class NormativeStatusResponse(BaseModel):
    loaded: bool
    source_path: str | None
    loaded_at: str | None
    indexed_sections: int
    indexed_documents: int
    indexed_categories: int
    cache_backend: str
    cache_entries: int
    cache_ttl_seconds: int
    cache_max_entries: int
    redis_state: str
    redis_last_error: str | None
    last_error: str | None


class CurriculumAreaResponse(BaseModel):
    area_id: str
    area_name: str
    evaluation_criteria: list[str] = []
    contents: list[str]


class CurriculumCatalogResponse(BaseModel):
    region: str
    stage: str
    source: str
    normative_notes: list[str]
    areas: list[CurriculumAreaResponse]


@router.get("/status", response_model=NormativeStatusResponse)
async def get_normative_status(_guard=Depends(require_admin_or_vpn)):
    return NormativeRetrievalService.get_status()


@router.get("/search", response_model=NormativeSearchResponse)
async def search_normative(
    query: str = Query(..., min_length=2, max_length=500, description="Consulta normativa"),
    page: int = Query(1, ge=1, description="Página (1-indexed)"),
    page_size: int = Query(5, ge=1, le=10, description="Resultados por página"),
):
    try:
        return NormativeRetrievalService.search(query=query, page=page, page_size=page_size)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/curriculum/galicia/primary", response_model=CurriculumCatalogResponse)
async def get_galicia_primary_curriculum():
    """Initial curriculum catalog for reinforcement plan tooling."""
    return GaliciaCurriculumService.get_primary_catalog()
