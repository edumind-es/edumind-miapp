#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from uuid import uuid4

import pytest
from sqlmodel import Session, select

from app.db import engine
from app.models import (
    BackgroundTaskJob,
    BackgroundTaskStatus,
    Document,
    TrainingItem,
    User,
    UserRole,
)
from app.services.background_task_queue_service import (
    enqueue_document_parse_job,
    enqueue_provider_alert_push_job,
    execute_claimed_job,
    process_background_job_payload,
)
from main import app
import app.api.v1.dataset as dataset_api


def _create_admin_user(session: Session) -> User:
    suffix = uuid4().hex[:10]
    user = User(
        username=f"admin_{suffix}",
        email=f"admin_{suffix}@example.com",
        role=UserRole.ADMIN,
        hashed_password="test-password",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture
def admin_dataset_context():
    with Session(engine) as session:
        admin_user = _create_admin_user(session)
        admin_id = admin_user.id
        admin_snapshot = User(
            id=admin_user.id,
            username=admin_user.username,
            email=admin_user.email,
            role=admin_user.role,
            hashed_password=admin_user.hashed_password,
            is_active=admin_user.is_active,
            created_at=admin_user.created_at,
        )

    def _override():
        return admin_snapshot

    app.dependency_overrides[dataset_api.get_current_user] = _override
    app.dependency_overrides[dataset_api.require_admin_from_vpn] = _override

    yield {"admin_id": admin_id}

    app.dependency_overrides.pop(dataset_api.get_current_user, None)
    app.dependency_overrides.pop(dataset_api.require_admin_from_vpn, None)

    with Session(engine) as session:
        for job in session.exec(select(BackgroundTaskJob)).all():
            session.delete(job)
        for item in session.exec(select(TrainingItem)).all():
            if item.creator_id == admin_id:
                session.delete(item)
        for doc in session.exec(select(Document)).all():
            if doc.uploader_id == admin_id:
                Path(doc.file_path).unlink(missing_ok=True)
                session.delete(doc)
        user = session.get(User, admin_id)
        if user:
            session.delete(user)
        session.commit()


def test_dataset_upload_auto_parse_enqueues_background_job(
    client,
    api_v1_prefix,
    admin_dataset_context,
):
    response = client.post(
        f"{api_v1_prefix}/dataset/upload",
        files={"file": ("qa.txt", b"Pregunta: Hola?\nRespuesta: Mundo", "text/plain")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "queued_for_processing"
    assert payload["processing_status"] == "queued"
    assert payload["items_created"] == 0
    assert isinstance(payload["background_job_id"], int)

    with Session(engine) as session:
        document = session.get(Document, payload["id"])
        assert document is not None
        assert document.processing_status == "queued"
        assert document.processed is False

        job = session.get(BackgroundTaskJob, payload["background_job_id"])
        assert job is not None
        assert job.task_type == "document_parse"
        assert job.status == BackgroundTaskStatus.QUEUED


def test_process_background_job_payload_marks_document_completed_and_creates_items(
    admin_dataset_context,
    monkeypatch,
    tmp_path,
):
    admin_id = admin_dataset_context["admin_id"]
    with Session(engine) as session:
        # Directorio temporal de pytest: la ruta absoluta del servidor no existe en CI
        file_path = tmp_path / f"test_{uuid4().hex[:8]}.txt"
        file_path.write_text("contenido temporal", encoding="utf-8")
        document = Document(
            filename=file_path.name,
            file_path=str(file_path),
            file_type="text",
            uploader_id=admin_id,
            processing_status="queued",
        )
        session.add(document)
        session.commit()
        session.refresh(document)

        job = enqueue_document_parse_job(session, document_id=document.id)
        job.status = BackgroundTaskStatus.RUNNING
        job.claimed_at = datetime.utcnow()
        session.add(job)
        session.commit()
        job_id = job.id
        document_id = document.id

    monkeypatch.setattr(
        "app.services.background_task_queue_service.parse_file",
        lambda _path: "Pregunta: Hola?\nRespuesta: Mundo",
    )
    monkeypatch.setattr(
        "app.services.background_task_queue_service.extract_training_pairs",
        lambda _text, source_type="text": [
            {"instruction": "Hola?", "output": "Mundo", "source": source_type}
        ],
    )

    result = process_background_job_payload(job_id)
    assert result["document_id"] == document_id
    assert result["items_created"] == 1

    with Session(engine) as session:
        document = session.get(Document, document_id)
        assert document is not None
        assert document.processed is True
        assert document.processing_status == "completed"
        created_items = session.exec(
            select(TrainingItem).where(TrainingItem.creator_id == admin_id)
        ).all()
        assert len(created_items) == 1


def test_execute_claimed_job_requeues_on_failure_and_updates_document_status(
    admin_dataset_context,
    monkeypatch,
    tmp_path,
):
    admin_id = admin_dataset_context["admin_id"]
    with Session(engine) as session:
        # Directorio temporal de pytest: la ruta absoluta del servidor no existe en CI
        file_path = tmp_path / f"test_{uuid4().hex[:8]}.txt"
        file_path.write_text("contenido temporal", encoding="utf-8")
        document = Document(
            filename=file_path.name,
            file_path=str(file_path),
            file_type="text",
            uploader_id=admin_id,
            processing_status="queued",
        )
        session.add(document)
        session.commit()
        session.refresh(document)

        job = enqueue_document_parse_job(session, document_id=document.id)
        job.status = BackgroundTaskStatus.RUNNING
        job.claimed_at = datetime.utcnow()
        session.add(job)
        session.commit()
        job_id = job.id
        document_id = document.id

    monkeypatch.setattr(
        "app.services.background_task_queue_service._run_job_subprocess",
        lambda _job_id, _timeout: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    result = execute_claimed_job(job_id, worker_id="test-worker")
    assert result["status"] == "requeued"

    with Session(engine) as session:
        job = session.get(BackgroundTaskJob, job_id)
        document = session.get(Document, document_id)
        assert job is not None
        assert job.status == BackgroundTaskStatus.QUEUED
        assert job.attempts == 1
        assert document is not None
        assert document.processing_status == "queued"
        assert "boom" in (document.parse_error or "")


def test_enqueue_provider_alert_push_job_dedupes_equal_alert_batches(admin_dataset_context):
    alerts = [
        {
            "provider": "edumind",
            "code": "timeout_spike",
            "level": "warning",
            "message": "Timeouts detectados",
        }
    ]

    with Session(engine) as session:
        job_a = enqueue_provider_alert_push_job(session, alerts)
        job_b = enqueue_provider_alert_push_job(session, alerts)

        assert job_a is not None
        assert job_b is not None
        assert job_a.id == job_b.id
