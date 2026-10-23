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
Knowledge API endpoints for searching and managing the knowledge base.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel

from app.services.knowledge_service import KnowledgeService
from app.api.v1.auth import require_admin_from_vpn, require_admin_or_vpn

router = APIRouter()


class DocumentInfo(BaseModel):
    name: str
    category: str
    

class SearchResult(BaseModel):
    name: str
    category: str
    snippet: str


class CategoryInfo(BaseModel):
    id: str
    description: str


@router.get("/categories", response_model=List[CategoryInfo])
async def list_categories(_guard=Depends(require_admin_or_vpn)):
    """List available knowledge categories."""
    categories = KnowledgeService.list_categories()
    return [CategoryInfo(id=k, description=v) for k, v in categories.items()]


@router.get("/documents", response_model=List[DocumentInfo])
async def list_documents(
    category: Optional[str] = Query(None, description="Filter by category"),
    _guard=Depends(require_admin_or_vpn),
):
    """List all documents in the knowledge base."""
    documents = KnowledgeService.list_documents(category)
    return [DocumentInfo(name=d.name, category=d.category) for d in documents]


@router.get("/search", response_model=List[SearchResult])
async def search_knowledge(
    query: str = Query(..., min_length=2, description="Search term"),
    category: Optional[str] = Query(None, description="Category filter"),
    _guard=Depends(require_admin_or_vpn),
):
    """
    Search across the knowledge base.
    Returns matching document snippets.
    """
    results = KnowledgeService.search(query, category)
    return [SearchResult(**r) for r in results[:10]]  # Limit to 10 results


@router.get("/document/{category}/{name}")
async def get_document(
    category: str,
    name: str,
    _guard=Depends(require_admin_or_vpn),
):
    """
    Get full content of a specific document.
    """
    doc = KnowledgeService.get_document(name, category)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "name": doc.name,
        "category": doc.category,
        "content": doc.content
    }


# Admin endpoints (protected)
@router.get("/admin/stats", dependencies=[Depends(require_admin_from_vpn)])
async def get_knowledge_stats():
    """Get statistics about the knowledge base (Admin only)."""
    stats = {}
    for category in KnowledgeService.list_categories().keys():
        docs = KnowledgeService.list_documents(category)
        stats[category] = {
            "document_count": len(docs),
            "documents": [d.name for d in docs]
        }
    
    return stats
