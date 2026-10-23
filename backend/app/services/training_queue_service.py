#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Persistent training queue + distributed worker utilities."""

from __future__ import annotations

import logging
import socket
import subprocess
import time
from datetime import datetime
from typing import Optional

from sqlalchemy import update
from sqlmodel import Session, func, select

from app.core.config import settings
from app.db import engine
from app.models import TrainingJob, TrainingJobStatus
from app.services.version_manager import version_manager

logger = logging.getLogger(__name__)


def queue_training_job(
    session: Session,
    job: TrainingJob,
    *,
    epochs: int,
    learning_rate: float,
    base_model: str,
) -> TrainingJob:
    """Persist a training request in queue (DB-backed)."""
    if job.status != TrainingJobStatus.READY:
        raise ValueError(f"Job {job.id} is not ready to queue (status={job.status})")

    job.status = TrainingJobStatus.QUEUED
    job.epochs = epochs
    job.learning_rate = learning_rate
    job.base_model = base_model
    job.started_at = None
    job.completed_at = None
    job.error_message = None

    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def get_queue_stats(session: Session) -> dict[str, int]:
    """Operational queue counters from persistent DB state."""
    queued = session.exec(
        select(func.count(TrainingJob.id)).where(TrainingJob.status == TrainingJobStatus.QUEUED)
    ).one()
    running = session.exec(
        select(func.count(TrainingJob.id)).where(TrainingJob.status == TrainingJobStatus.TRAINING)
    ).one()
    failed = session.exec(
        select(func.count(TrainingJob.id)).where(TrainingJob.status == TrainingJobStatus.FAILED)
    ).one()

    return {
        "queued": int(queued or 0),
        "running": int(running or 0),
        "failed": int(failed or 0),
    }


def claim_next_queued_job() -> Optional[int]:
    """
    Atomically claim the next queued job.
    Safe for multiple workers (compare-and-set by status).
    """
    with Session(engine) as session:
        queued_job_id = session.exec(
            select(TrainingJob.id)
            .where(TrainingJob.status == TrainingJobStatus.QUEUED)
            .order_by(TrainingJob.created_at.asc())
            .limit(1)
        ).first()

        if queued_job_id is None:
            return None

        stmt = (
            update(TrainingJob)
            .where(TrainingJob.id == int(queued_job_id))
            .where(TrainingJob.status == TrainingJobStatus.QUEUED)
            .values(
                status=TrainingJobStatus.TRAINING,
                started_at=datetime.utcnow(),
                completed_at=None,
                error_message=None,
            )
        )
        result = session.exec(stmt)
        if (result.rowcount or 0) != 1:
            session.rollback()
            return None

        session.commit()
        return int(queued_job_id)


def _resolve_training_python() -> str:
    venv_python = settings.BASE_DIR / ".venv" / "bin" / "python"
    return str(venv_python) if venv_python.exists() else "python"


def _run_subprocess_for_job(job: TrainingJob) -> subprocess.CompletedProcess:
    script_path = settings.BASE_DIR / "scripts" / "entrenar_lora.py"
    if not script_path.exists():
        raise FileNotFoundError("Training script not found")
    if not job.dataset_path:
        raise ValueError("Training job does not have dataset_path")

    dataset_path = settings.BASE_DIR / job.dataset_path
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset path not found: {dataset_path}")

    cmd = [
        _resolve_training_python(),
        str(script_path),
        "--dataset",
        str(dataset_path),
        "--epochs",
        str(job.epochs),
        "--learning-rate",
        str(job.learning_rate),
        "--base-model",
        job.base_model,
        "--output-name",
        job.version,
    ]
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=3600 * 6,
    )


def execute_claimed_job(job_id: int, worker_id: str) -> dict[str, str]:
    """Execute a previously-claimed job and persist final status."""
    with Session(engine) as session:
        job = session.get(TrainingJob, job_id)
        if not job:
            return {"status": "missing", "job_id": str(job_id), "worker_id": worker_id}

        if job.status != TrainingJobStatus.TRAINING:
            return {
                "status": "skipped",
                "job_id": str(job_id),
                "worker_id": worker_id,
                "reason": f"status={job.status}",
            }

        try:
            result = _run_subprocess_for_job(job)
            if result.returncode == 0:
                job.status = TrainingJobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                model_path = f"modelos_lora/{job.version}"
                version_manager.register_model(
                    version=job.version.replace("edumind-v", ""),
                    dataset_path=job.dataset_path or "",
                    model_path=model_path,
                    example_count=job.example_count,
                    base_model=job.base_model,
                    epochs=job.epochs,
                    learning_rate=job.learning_rate,
                )
                job.model_path = model_path
                result_status = "completed"
            else:
                job.status = TrainingJobStatus.FAILED
                job.completed_at = datetime.utcnow()
                details = (result.stderr or result.stdout or "Unknown training error").strip()
                job.error_message = details[:1000]
                result_status = "failed"
        except subprocess.TimeoutExpired:
            job.status = TrainingJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = "Training timed out after 6 hours"
            result_status = "failed"
        except Exception as exc:
            job.status = TrainingJobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(exc)[:1000]
            result_status = "failed"

        session.add(job)
        session.commit()

        return {
            "status": result_status,
            "job_id": str(job.id),
            "worker_id": worker_id,
            "version": job.version,
        }


def process_next_job(worker_id: str) -> Optional[dict[str, str]]:
    """Claim and execute a queued job. Returns None if queue is empty."""
    job_id = claim_next_queued_job()
    if job_id is None:
        return None

    logger.info("Training worker '%s' processing job_id=%s", worker_id, job_id)
    return execute_claimed_job(job_id, worker_id=worker_id)


def run_worker_loop(
    *,
    worker_id: Optional[str] = None,
    poll_interval_seconds: float = 3.0,
    max_jobs: Optional[int] = None,
    once: bool = False,
) -> int:
    """
    Run worker loop and return number of processed jobs.
    If once=True it performs at most one dequeue/execute cycle.
    """
    active_worker_id = worker_id or f"{socket.gethostname()}-{int(time.time())}"
    processed = 0

    if once:
        result = process_next_job(active_worker_id)
        return 1 if result else 0

    while True:
        result = process_next_job(active_worker_id)
        if result:
            processed += 1
            if max_jobs is not None and processed >= max_jobs:
                return processed
            continue

        time.sleep(max(poll_interval_seconds, 0.5))
