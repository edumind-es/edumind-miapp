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

"""Dataset Builder API - CRUD, Upload, Verify, Export."""
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.api.v1.auth import get_current_user, require_admin_from_vpn
from app.services.dataset_privacy import scrub_personal_data
from app.core.config import settings
from app.db import get_session
from app.models import Document, TrainingItem, TrainingItemSource, User, UserRole
from app.services.background_task_queue_service import enqueue_document_parse_job
from app.services.parsers import get_file_type

router = APIRouter()


# ============ Schemas ============

class TrainingItemCreate(BaseModel):
    instruction: str
    output: str
    source: str = "manual"


class TrainingItemUpdate(BaseModel):
    instruction: Optional[str] = None
    output: Optional[str] = None
    quality_score: Optional[int] = None


class TrainingItemOut(BaseModel):
    id: int
    instruction: str
    output: str
    source: str
    quality_score: int
    is_verified: bool
    created_at: datetime


class DocumentOut(BaseModel):
    id: int
    filename: str
    file_type: str
    processed: bool
    processing_status: str
    parse_error: Optional[str]
    uploaded_at: datetime
    processing_started_at: Optional[datetime]
    processed_at: Optional[datetime]


class DatasetStats(BaseModel):
    total_items: int
    verified_items: int
    pending_items: int
    total_documents: int


def _is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def _assert_item_access(item: TrainingItem, current_user: User):
    if _is_admin(current_user):
        return
    if item.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions for this dataset item.")


def _normalize_filename(filename: str) -> str:
    base = Path(filename or "").name
    if not base:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    sanitized = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return sanitized[:180]


def _build_secure_upload_path(original_filename: str) -> Path:
    base_name = _normalize_filename(original_filename)
    unique_name = f"{datetime.utcnow():%Y%m%d_%H%M%S}_{uuid4().hex[:10]}_{base_name}"
    uploads_root = settings.UPLOADS_DIR.resolve()
    target_path = (uploads_root / unique_name).resolve()
    if uploads_root not in target_path.parents:
        raise HTTPException(status_code=400, detail="Invalid upload path.")
    return target_path


def _safe_export_file_path(filename: str) -> Path:
    safe_name = Path(filename).name
    if safe_name != filename or not safe_name.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="Invalid export filename.")
    training_root = settings.TRAINING_DIR.resolve()
    resolved = (training_root / safe_name).resolve()
    if training_root not in resolved.parents:
        raise HTTPException(status_code=400, detail="Invalid export path.")
    return resolved


# ============ Stats ============

@router.get("/stats", response_model=DatasetStats)
async def get_dataset_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get dataset statistics (admin: global, user: own items)."""
    item_count_query = select(func.count(TrainingItem.id))
    verified_count_query = select(func.count(TrainingItem.id)).where(TrainingItem.is_verified == True)
    docs_count_query = select(func.count(Document.id))

    if not _is_admin(current_user):
        item_count_query = item_count_query.where(TrainingItem.creator_id == current_user.id)
        verified_count_query = verified_count_query.where(TrainingItem.creator_id == current_user.id)
        docs_count_query = docs_count_query.where(Document.uploader_id == current_user.id)

    total = session.exec(item_count_query).one()
    verified = session.exec(verified_count_query).one()
    docs = session.exec(docs_count_query).one()

    return DatasetStats(
        total_items=total,
        verified_items=verified,
        pending_items=total - verified,
        total_documents=docs,
    )


# ============ Training Items CRUD ============

@router.get("/items", response_model=List[TrainingItemOut])
async def list_items(
    skip: int = 0,
    limit: int = 100,
    verified_only: bool = False,
    pending_only: bool = False,
    source: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List training items with filters."""
    query = select(TrainingItem).order_by(TrainingItem.created_at.desc())

    if verified_only:
        query = query.where(TrainingItem.is_verified == True)
    if pending_only:
        query = query.where(TrainingItem.is_verified == False)
    if source:
        query = query.where(TrainingItem.source == source)
    if not _is_admin(current_user):
        query = query.where(TrainingItem.creator_id == current_user.id)

    query = query.offset(skip).limit(limit)
    items = session.exec(query).all()

    return [
        TrainingItemOut(
            id=item.id,
            instruction=item.instruction,
            output=item.output,
            source=item.source.value if hasattr(item.source, "value") else str(item.source),
            quality_score=item.quality_score,
            is_verified=item.is_verified,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.post("/items", response_model=TrainingItemOut)
async def create_item(
    item: TrainingItemCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Create a new training item."""
    try:
        source = TrainingItemSource(item.source)
    except ValueError:
        source = TrainingItemSource.MANUAL

    instruction, _ = scrub_personal_data(item.instruction)
    output, _ = scrub_personal_data(item.output)
    db_item = TrainingItem(
        instruction=instruction,
        output=output,
        source=source,
        creator_id=current_user.id,
    )
    session.add(db_item)
    session.commit()
    session.refresh(db_item)

    return TrainingItemOut(
        id=db_item.id,
        instruction=db_item.instruction,
        output=db_item.output,
        source=db_item.source.value,
        quality_score=db_item.quality_score,
        is_verified=db_item.is_verified,
        created_at=db_item.created_at,
    )


@router.get("/items/{item_id}", response_model=TrainingItemOut)
async def get_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get a specific training item."""
    item = session.get(TrainingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _assert_item_access(item, current_user)

    return TrainingItemOut(
        id=item.id,
        instruction=item.instruction,
        output=item.output,
        source=item.source.value if hasattr(item.source, "value") else str(item.source),
        quality_score=item.quality_score,
        is_verified=item.is_verified,
        created_at=item.created_at,
    )


@router.put("/items/{item_id}", response_model=TrainingItemOut)
async def update_item(
    item_id: int,
    update: TrainingItemUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update a training item."""
    item = session.get(TrainingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _assert_item_access(item, current_user)

    if update.instruction is not None:
        item.instruction = update.instruction
    if update.output is not None:
        item.output = update.output
    if update.quality_score is not None:
        item.quality_score = update.quality_score

    session.add(item)
    session.commit()
    session.refresh(item)

    return TrainingItemOut(
        id=item.id,
        instruction=item.instruction,
        output=item.output,
        source=item.source.value if hasattr(item.source, "value") else str(item.source),
        quality_score=item.quality_score,
        is_verified=item.is_verified,
        created_at=item.created_at,
    )


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete a training item."""
    item = session.get(TrainingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _assert_item_access(item, current_user)

    session.delete(item)
    session.commit()

    return {"message": "Item deleted"}


@router.post("/items/{item_id}/verify")
async def verify_item(
    item_id: int,
    current_user: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    """Mark a training item as verified."""
    item = session.get(TrainingItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.is_verified = True
    item.verified_by_id = current_user.id
    # Al pasar al fondo común el ítem deja de estar vinculado a quien lo aportó.
    item.creator_id = None
    session.add(item)
    session.commit()

    return {"message": "Item verified", "id": item_id}


@router.post("/items/bulk-verify")
async def bulk_verify(
    item_ids: List[int],
    current_user: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    """Verify multiple items at once."""
    count = 0
    for item_id in item_ids:
        item = session.get(TrainingItem, item_id)
        if item and not item.is_verified:
            item.is_verified = True
            item.verified_by_id = current_user.id
            item.creator_id = None
            session.add(item)
            count += 1

    session.commit()
    return {"message": f"{count} items verified"}


# ============ File Upload ============

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    auto_parse: bool = True,
    current_user: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    """Upload a file (PDF, DOCX, XLSX, PPTX, MD, JSON, PNG). Solo administración: alimenta el dataset común."""
    normalized_filename = _normalize_filename(file.filename)
    file_type = get_file_type(normalized_filename)
    if file_type == "unknown":
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {normalized_filename}")

    file_location = _build_secure_upload_path(normalized_filename)
    max_upload_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    written = 0

    try:
        with open(file_location, "wb") as file_object:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum allowed is {settings.MAX_UPLOAD_SIZE_MB} MB.",
                    )
                file_object.write(chunk)
    except HTTPException:
        if file_location.exists():
            file_location.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    doc = Document(
        filename=normalized_filename,
        file_path=str(file_location),
        file_type=file_type,
        uploader_id=current_user.id,
        processing_status="uploaded",
    )
    session.add(doc)
    session.commit()
    session.refresh(doc)

    items_created = 0
    background_job_id: int | None = None
    if auto_parse:
        doc.processing_status = "queued"
        session.add(doc)
        session.commit()
        session.refresh(doc)
        job = enqueue_document_parse_job(session, document_id=doc.id)
        background_job_id = job.id

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_type": file_type,
        "status": "queued_for_processing" if auto_parse else "uploaded",
        "processing_status": doc.processing_status,
        "items_created": items_created,
        "background_job_id": background_job_id,
    }


@router.get("/documents", response_model=List[DocumentOut])
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List uploaded documents."""
    query = select(Document).order_by(Document.uploaded_at.desc()).offset(skip).limit(limit)
    if not _is_admin(current_user):
        query = query.where(Document.uploader_id == current_user.id)

    docs = session.exec(query).all()
    return [
        DocumentOut(
            id=d.id,
            filename=d.filename,
            file_type=d.file_type,
            processed=d.processed,
            processing_status=d.processing_status,
            parse_error=d.parse_error,
            uploaded_at=d.uploaded_at,
            processing_started_at=d.processing_started_at,
            processed_at=d.processed_at,
        )
        for d in docs
    ]


# ============ Export ============

@router.post("/export")
async def export_dataset(
    verified_only: bool = True,
    current_user: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    """Export verified items to JSONL format for training."""
    query = select(TrainingItem)
    if verified_only:
        query = query.where(TrainingItem.is_verified == True)

    items = session.exec(query).all()
    if not items:
        raise HTTPException(status_code=400, detail="No items to export")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"training_dataset_{timestamp}.jsonl"
    export_path = settings.TRAINING_DIR / filename

    with open(export_path, "w", encoding="utf-8") as f:
        for item in items:
            record = {"prompt": item.instruction, "completion": item.output}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return {
        "filename": filename,
        "path": str(export_path),
        "count": len(items),
        "message": f"Exported {len(items)} items to {filename}",
    }


@router.get("/export/{filename}")
async def download_export(
    filename: str,
    current_user: User = Depends(require_admin_from_vpn),
):
    """Download an exported JSONL file (admin only)."""
    file_path = _safe_export_file_path(filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type="application/jsonl",
    )
