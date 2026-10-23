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

"""Training Pipeline API - Prepare, Train, Monitor."""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import TrainingJob, TrainingJobStatus, TrainingItem, User
from app.core.config import settings
from app.api.v1.auth import require_admin_from_vpn
from app.services.training_queue_service import get_queue_stats, queue_training_job
from app.services.version_manager import version_manager

router = APIRouter()


# ============ Schemas ============

class ModelVersion(BaseModel):
    version: str
    version_name: str
    dataset_path: str
    model_path: str
    example_count: int
    base_model: str
    epochs: int
    learning_rate: float
    created_at: str
    notes: Optional[str] = None


class TrainingJobOut(BaseModel):
    id: int
    version: str
    status: str
    dataset_path: Optional[str]
    model_path: Optional[str]
    example_count: int
    epochs: int
    learning_rate: float
    base_model: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]


class PrepareRequest(BaseModel):
    verified_only: bool = True
    major_version: bool = False


class TrainRequest(BaseModel):
    job_id: int
    epochs: int = 3
    learning_rate: float = 2e-4
    base_model: str = "mistralai/Mistral-7B-v0.1"


class TrainingQueueStats(BaseModel):
    queued: int
    running: int
    failed: int


# ============ Endpoints ============

@router.get("/models", response_model=List[ModelVersion])
async def list_models(admin: User = Depends(require_admin_from_vpn)):
    """List all trained model versions."""
    versions = version_manager.get_all_versions()
    return [ModelVersion(**v) for v in versions]


@router.get("/models/latest", response_model=Optional[ModelVersion])
async def get_latest_model(admin: User = Depends(require_admin_from_vpn)):
    """Get the latest trained model version."""
    latest = version_manager.get_latest_version()
    if not latest:
        return None
    return ModelVersion(**latest)


@router.get("/jobs", response_model=List[TrainingJobOut])
async def list_jobs(
    skip: int = 0,
    limit: int = 20,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """List training jobs."""
    jobs = session.exec(
        select(TrainingJob)
        .order_by(TrainingJob.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    
    return [
        TrainingJobOut(
            id=j.id,
            version=j.version,
            status=j.status.value if hasattr(j.status, 'value') else str(j.status),
            dataset_path=j.dataset_path,
            model_path=j.model_path,
            example_count=j.example_count,
            epochs=j.epochs,
            learning_rate=j.learning_rate,
            base_model=j.base_model,
            created_at=j.created_at,
            started_at=j.started_at,
            completed_at=j.completed_at,
            error_message=j.error_message
        ) for j in jobs
    ]


@router.get("/queue/stats", response_model=TrainingQueueStats)
async def get_training_queue_stats(
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    """Queue telemetry for distributed training workers."""
    return TrainingQueueStats(**get_queue_stats(session))


@router.get("/jobs/{job_id}", response_model=TrainingJobOut)
async def get_job(
    job_id: int,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get a specific training job."""
    job = session.get(TrainingJob, job_id)
    if not job:
        raise HTTPException(404, "Training job not found")
    
    return TrainingJobOut(
        id=job.id,
        version=job.version,
        status=job.status.value if hasattr(job.status, 'value') else str(job.status),
        dataset_path=job.dataset_path,
        model_path=job.model_path,
        example_count=job.example_count,
        epochs=job.epochs,
        learning_rate=job.learning_rate,
        base_model=job.base_model,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message
    )


@router.post("/prepare")
async def prepare_dataset(
    request: PrepareRequest,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Prepare a dataset for training - export verified items to JSONL."""
    # Get items
    query = select(TrainingItem)
    if request.verified_only:
        query = query.where(TrainingItem.is_verified == True)
    
    items = session.exec(query).all()
    
    if not items:
        raise HTTPException(400, "No items to export. Verify some training items first.")
    
    # Generate version and filename
    next_version = version_manager.get_next_version(major=request.major_version)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"edumind_v{next_version}_{timestamp}.jsonl"
    export_path = settings.TRAINING_DIR / filename
    
    # Write JSONL
    with open(export_path, 'w', encoding='utf-8') as f:
        for item in items:
            record = {
                "prompt": item.instruction,
                "completion": item.output
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    
    # Create training job
    job = TrainingJob(
        version=f"edumind-v{next_version}",
        status=TrainingJobStatus.READY,
        dataset_path=str(export_path.relative_to(settings.BASE_DIR)),
        example_count=len(items),
        created_by_id=admin.id
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    
    return {
        "job_id": job.id,
        "version": job.version,
        "dataset_path": job.dataset_path,
        "example_count": len(items),
        "status": "ready",
        "message": f"Dataset prepared with {len(items)} items. Ready for training."
    }


@router.post("/start/{job_id}")
async def start_training(
    job_id: int,
    request: TrainRequest,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Queue a prepared training job for distributed worker execution."""
    if request.job_id != job_id:
        raise HTTPException(400, "Path job_id and payload job_id do not match")

    job = session.get(TrainingJob, job_id)
    if not job:
        raise HTTPException(404, "Training job not found")
    
    if job.status != TrainingJobStatus.READY:
        raise HTTPException(400, f"Job is not ready for training. Current status: {job.status}")
    
    # Check if training script exists
    script_path = settings.BASE_DIR / "scripts" / "entrenar_lora.py"
    if not script_path.exists():
        raise HTTPException(500, "Training script not found. Please set up the training environment.")

    queue_training_job(
        session,
        job,
        epochs=request.epochs,
        learning_rate=request.learning_rate,
        base_model=request.base_model,
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "message": (
            "Training job queued. Run worker with "
            "'python scripts/training_worker.py' and track progress in /training/jobs/{job_id}"
        ),
    }


@router.get("/logs/{job_id}")
async def get_training_logs(
    job_id: int,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get training logs for a job."""
    job = session.get(TrainingJob, job_id)
    if not job:
        raise HTTPException(404, "Training job not found")
    
    # Read from training.log if exists
    log_path = settings.BASE_DIR / "training.log"
    logs = ""
    if log_path.exists():
        with open(log_path, 'r', encoding='utf-8') as f:
            logs = f.read()
    
    return {
        "job_id": job_id,
        "version": job.version,
        "status": job.status.value if hasattr(job.status, 'value') else str(job.status),
        "logs": logs,
        "error_message": job.error_message
    }
