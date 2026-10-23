#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""Persistent background task queue + worker utilities."""

from __future__ import annotations

import hashlib
import json
import logging
import socket
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import update
from sqlmodel import Session, select

from app.core.config import settings
from app.db import engine
from app.models import (
    BackgroundTaskJob,
    BackgroundTaskStatus,
    Document,
    TrainingItem,
    TrainingItemSource,
)
from app.services.parsers import extract_training_pairs, parse_file
from app.services.provider_alert_push_service import dispatch_provider_alerts

logger = logging.getLogger(__name__)

TASK_DOCUMENT_PARSE = "document_parse"
TASK_PROVIDER_ALERT_PUSH = "provider_alert_push"


def enqueue_background_task(
    session: Session,
    *,
    task_type: str,
    payload: dict[str, Any],
    dedupe_key: str | None = None,
    max_attempts: int | None = None,
) -> BackgroundTaskJob:
    if dedupe_key:
        existing = session.exec(
            select(BackgroundTaskJob)
            .where(BackgroundTaskJob.task_type == task_type)
            .where(BackgroundTaskJob.dedupe_key == dedupe_key)
            .where(
                BackgroundTaskJob.status.in_(
                    [BackgroundTaskStatus.QUEUED, BackgroundTaskStatus.RUNNING]
                )
            )
            .order_by(BackgroundTaskJob.created_at.desc())
        ).first()
        if existing:
            return existing

    job = BackgroundTaskJob(
        task_type=task_type,
        dedupe_key=dedupe_key,
        payload=json.dumps(payload, ensure_ascii=False),
        max_attempts=max_attempts or settings.BACKGROUND_TASK_MAX_ATTEMPTS,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def enqueue_document_parse_job(session: Session, *, document_id: int) -> BackgroundTaskJob:
    return enqueue_background_task(
        session,
        task_type=TASK_DOCUMENT_PARSE,
        payload={"document_id": int(document_id)},
        dedupe_key=f"document:{int(document_id)}",
    )


def enqueue_provider_alert_push_job(
    session: Session,
    alerts: list[dict[str, Any]],
) -> BackgroundTaskJob | None:
    if not alerts:
        return None

    fingerprints = sorted(
        f"{(alert.get('provider') or 'global').strip().lower()}|"
        f"{(alert.get('code') or 'unknown').strip().lower()}|"
        f"{(alert.get('level') or 'warning').strip().lower()}"
        for alert in alerts
    )
    dedupe_hash = hashlib.sha256("\n".join(fingerprints).encode("utf-8")).hexdigest()

    return enqueue_background_task(
        session,
        task_type=TASK_PROVIDER_ALERT_PUSH,
        payload={"alerts": alerts},
        dedupe_key=f"provider-alert:{dedupe_hash}",
        max_attempts=max(settings.BACKGROUND_TASK_MAX_ATTEMPTS, 2),
    )


def get_background_queue_stats(session: Session) -> dict[str, int]:
    jobs = session.exec(select(BackgroundTaskJob)).all()
    stats = {
        "queued": 0,
        "running": 0,
        "completed": 0,
        "failed": 0,
    }
    for job in jobs:
        key = str(job.status.value if hasattr(job.status, "value") else job.status)
        if key in stats:
            stats[key] += 1
    return stats


def claim_next_queued_job() -> Optional[int]:
    now = datetime.utcnow()
    with Session(engine) as session:
        queued_job_id = session.exec(
            select(BackgroundTaskJob.id)
            .where(BackgroundTaskJob.status == BackgroundTaskStatus.QUEUED)
            .where(BackgroundTaskJob.available_at <= now)
            .order_by(BackgroundTaskJob.available_at.asc(), BackgroundTaskJob.created_at.asc())
            .limit(1)
        ).first()

        if queued_job_id is None:
            return None

        stmt = (
            update(BackgroundTaskJob)
            .where(BackgroundTaskJob.id == int(queued_job_id))
            .where(BackgroundTaskJob.status == BackgroundTaskStatus.QUEUED)
            .values(
                status=BackgroundTaskStatus.RUNNING,
                claimed_at=now,
                updated_at=now,
            )
        )
        result = session.exec(stmt)
        if (result.rowcount or 0) != 1:
            session.rollback()
            return None

        session.commit()
        return int(queued_job_id)


def _resolve_worker_python() -> str:
    venv_python = settings.BASE_DIR / ".venv" / "bin" / "python"
    return str(venv_python) if venv_python.exists() else "python"


def _process_script_path() -> Path:
    return settings.BASE_DIR / "scripts" / "process_background_job.py"


def _timeout_seconds_for_task(task_type: str) -> int:
    if task_type == TASK_DOCUMENT_PARSE:
        return settings.BACKGROUND_TASK_DOCUMENT_TIMEOUT_SECONDS
    if task_type == TASK_PROVIDER_ALERT_PUSH:
        return settings.BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS
    return max(settings.BACKGROUND_TASK_ALERT_TIMEOUT_SECONDS, 5)


def _retry_delay_seconds(attempt_number: int) -> int:
    base = max(settings.BACKGROUND_TASK_RETRY_BASE_SECONDS, 1)
    delay = base * (2 ** max(attempt_number - 1, 0))
    return min(delay, 900)


def _run_job_subprocess(job_id: int, timeout_seconds: int) -> dict[str, Any]:
    script_path = _process_script_path()
    if not script_path.exists():
        raise FileNotFoundError("Background task processor script not found")

    cmd = [
        _resolve_worker_python(),
        str(script_path),
        "--job-id",
        str(job_id),
    ]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        cwd=str(settings.BASE_DIR),
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Background task failed").strip()
        raise RuntimeError(detail[:2000])

    lines = [line.strip() for line in (result.stdout or "").splitlines() if line.strip()]
    if not lines:
        return {}
    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError:
        return {"stdout": lines[-1]}


def _mark_document_processing_state(
    session: Session,
    document_id: int,
    *,
    processing_status: str,
    parse_error: str | None = None,
    processed: bool | None = None,
    processing_started_at: datetime | None = None,
) -> None:
    document = session.get(Document, document_id)
    if not document:
        return

    document.processing_status = processing_status
    document.parse_error = parse_error
    if processed is not None:
        document.processed = processed
    if processing_started_at is not None:
        document.processing_started_at = processing_started_at
    if processing_status != "completed":
        document.processed_at = None
    session.add(document)
    session.commit()


def _handle_job_failure(
    session: Session,
    job: BackgroundTaskJob,
    *,
    error_message: str,
    worker_id: str,
) -> dict[str, str]:
    now = datetime.utcnow()
    trimmed_error = (error_message or "Unknown background task error").strip()[:2000]
    payload = _load_job_payload(job)

    if job.attempts >= job.max_attempts:
        job.status = BackgroundTaskStatus.FAILED
        job.completed_at = now
        job.last_error = trimmed_error
        job.updated_at = now
        job.worker_id = worker_id
        session.add(job)
        session.commit()

        if job.task_type == TASK_DOCUMENT_PARSE:
            _mark_document_processing_state(
                session,
                int(payload.get("document_id", 0)),
                processing_status="failed",
                parse_error=trimmed_error,
                processed=False,
            )

        return {
            "status": "failed",
            "job_id": str(job.id),
            "worker_id": worker_id,
            "task_type": job.task_type,
        }

    job.status = BackgroundTaskStatus.QUEUED
    job.available_at = now + timedelta(seconds=_retry_delay_seconds(job.attempts))
    job.claimed_at = None
    job.last_error = trimmed_error
    job.updated_at = now
    job.worker_id = None
    session.add(job)
    session.commit()

    if job.task_type == TASK_DOCUMENT_PARSE:
        _mark_document_processing_state(
            session,
            int(payload.get("document_id", 0)),
            processing_status="queued",
            parse_error=trimmed_error,
            processed=False,
        )

    return {
        "status": "requeued",
        "job_id": str(job.id),
        "worker_id": worker_id,
        "task_type": job.task_type,
    }


def _load_job_payload(job: BackgroundTaskJob) -> dict[str, Any]:
    try:
        return json.loads(job.payload or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid background task payload: {exc}") from exc


def execute_claimed_job(job_id: int, worker_id: str) -> dict[str, str]:
    with Session(engine) as session:
        job = session.get(BackgroundTaskJob, job_id)
        if not job:
            return {"status": "missing", "job_id": str(job_id), "worker_id": worker_id}

        if job.status != BackgroundTaskStatus.RUNNING:
            return {
                "status": "skipped",
                "job_id": str(job.id),
                "worker_id": worker_id,
                "reason": f"status={job.status}",
            }

        payload = _load_job_payload(job)
        job.attempts += 1
        job.updated_at = datetime.utcnow()
        job.worker_id = worker_id
        session.add(job)
        session.commit()

        if job.task_type == TASK_DOCUMENT_PARSE:
            _mark_document_processing_state(
                session,
                int(payload.get("document_id", 0)),
                processing_status="processing",
                parse_error=None,
                processed=False,
                processing_started_at=datetime.utcnow(),
            )

        timeout_seconds = _timeout_seconds_for_task(job.task_type)

    try:
        result_payload = _run_job_subprocess(job_id, timeout_seconds)
    except subprocess.TimeoutExpired:
        with Session(engine) as session:
            job = session.get(BackgroundTaskJob, job_id)
            if not job:
                return {"status": "missing", "job_id": str(job_id), "worker_id": worker_id}
            return _handle_job_failure(
                session,
                job,
                error_message=f"Task timed out after {timeout_seconds} seconds",
                worker_id=worker_id,
            )
    except Exception as exc:
        with Session(engine) as session:
            job = session.get(BackgroundTaskJob, job_id)
            if not job:
                return {"status": "missing", "job_id": str(job_id), "worker_id": worker_id}
            return _handle_job_failure(
                session,
                job,
                error_message=str(exc),
                worker_id=worker_id,
            )

    with Session(engine) as session:
        job = session.get(BackgroundTaskJob, job_id)
        if not job:
            return {"status": "missing", "job_id": str(job_id), "worker_id": worker_id}

        job.status = BackgroundTaskStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        job.updated_at = datetime.utcnow()
        job.worker_id = worker_id
        if result_payload:
            job.result = json.dumps(result_payload, ensure_ascii=False)[:4000]
        job.last_error = None
        session.add(job)
        session.commit()

        return {
            "status": "completed",
            "job_id": str(job.id),
            "worker_id": worker_id,
            "task_type": job.task_type,
        }


def _process_document_parse(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    document_id = int(payload.get("document_id", 0))
    document = session.get(Document, document_id)
    if not document:
        raise FileNotFoundError(f"Document {document_id} not found")

    if document.processed and document.processing_status == "completed":
        return {"document_id": document_id, "items_created": 0, "already_processed": True}

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"Document file not found: {file_path}")

    text = parse_file(file_path)
    if not text or text.startswith("[Error:"):
        raise RuntimeError((text or "No useful text extracted from document").strip()[:2000])

    pairs = extract_training_pairs(text, source_type=document.file_type)
    if not pairs:
        raise RuntimeError("No training pairs could be extracted from the uploaded document.")

    items_created = 0
    for pair in pairs:
        try:
            source = TrainingItemSource(pair.get("source", "manual"))
        except ValueError:
            source = TrainingItemSource.MANUAL

        session.add(
            TrainingItem(
                instruction=pair["instruction"],
                output=pair["output"],
                source=source,
                creator_id=document.uploader_id,
            )
        )
        items_created += 1

    document.processed = True
    document.processing_status = "completed"
    document.parse_error = None
    document.processed_at = datetime.utcnow()
    session.add(document)
    session.commit()

    return {"document_id": document_id, "items_created": items_created}


def _process_provider_alert_push(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    alerts = payload.get("alerts") or []
    if not isinstance(alerts, list):
        raise ValueError("Invalid alerts payload for background provider alert task")
    sent = dispatch_provider_alerts(session, alerts, raise_on_failure=True)
    return {"alerts_received": len(alerts), "alerts_sent": sent}


def process_background_job_payload(job_id: int) -> dict[str, Any]:
    with Session(engine) as session:
        job = session.get(BackgroundTaskJob, job_id)
        if not job:
            raise FileNotFoundError(f"Background task job {job_id} not found")
        if job.status != BackgroundTaskStatus.RUNNING:
            raise RuntimeError(f"Background task job {job_id} is not running")

        payload = _load_job_payload(job)
        if job.task_type == TASK_DOCUMENT_PARSE:
            return _process_document_parse(session, payload)
        if job.task_type == TASK_PROVIDER_ALERT_PUSH:
            return _process_provider_alert_push(session, payload)
        raise ValueError(f"Unsupported background task type: {job.task_type}")


def process_next_job(worker_id: str) -> Optional[dict[str, str]]:
    job_id = claim_next_queued_job()
    if job_id is None:
        return None

    logger.info("Background worker '%s' processing job_id=%s", worker_id, job_id)
    return execute_claimed_job(job_id, worker_id=worker_id)


def run_worker_loop(
    *,
    worker_id: Optional[str] = None,
    poll_interval_seconds: float = 2.0,
    max_jobs: Optional[int] = None,
    once: bool = False,
) -> int:
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
