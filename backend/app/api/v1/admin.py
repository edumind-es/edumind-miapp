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

"""Admin API endpoints - Dashboard, Users, Config, Logs."""
import csv
import json
from io import BytesIO, StringIO
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.db import get_session
from app.models import (
    User, UserRole, TrainingItem, Document, TrainingJob, 
    ActivityLog, SystemConfig
)
from app.api.v1.auth import require_admin_from_vpn, get_password_hash
from app.core.prompt_registry import list_prompt_contracts
from app.core.queue_manager import queue_manager
from app.services.normative_service import NormativeRetrievalService
from app.services.metrics_service import (
    mask_ip_address,
    metrics,
    normalize_navigation_path,
    normalize_referrer_label,
)
from app.services.provider_observability_service import (
    apply_provider_guard_overrides,
    build_provider_alerts,
    build_provider_reliability,
    load_observability_alert_policy,
    load_provider_guard_overrides,
    safe_float,
    safe_int,
)
from app.services.training_queue_service import get_queue_stats

router = APIRouter()


def _coerce_user_role(raw_role: str) -> UserRole:
    normalized = (raw_role or "").strip().lower()
    try:
        return UserRole(normalized)
    except ValueError:
        allowed = ", ".join(role.value for role in UserRole)
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{raw_role}'. Allowed values: {allowed}",
        )


# ============ Schemas ============

class DashboardStats(BaseModel):
    total_users: int
    active_users_today: int
    total_training_items: int
    verified_items: int
    pending_items: int
    total_documents: int
    total_training_jobs: int
    latest_model_version: Optional[str]
    generations_today: int


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str = "docente"


class UserUpdate(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool
    created_at: datetime


class ConfigItem(BaseModel):
    key: str
    value: str


class LogEntry(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


class NavigationMetricItem(BaseModel):
    key: str
    count: int


class InvalidNavigationEvent(BaseModel):
    created_at: datetime
    path: str
    referrer: Optional[str]
    ip_address: Optional[str]
    user_id: Optional[int]


class InvalidNavigationMetrics(BaseModel):
    window_days: int
    total_events: int
    unique_paths: int
    unique_referrers: int
    top_paths: List[NavigationMetricItem]
    top_referrers: List[NavigationMetricItem]
    recent_events: List[InvalidNavigationEvent]
    runtime_invalid_total: int
    runtime_top_paths: List[NavigationMetricItem]
    runtime_top_referrers: List[NavigationMetricItem]


class ObservabilitySnapshot(BaseModel):
    queue: dict
    training_queue: dict
    normative_retrieval: dict
    prompt_contracts_count: int
    metrics: dict
    provider_alert_policy: dict
    provider_alerts: list[dict]
    provider_reliability: dict
    provider_guard_overrides: dict


def _build_observability_snapshot(session: Session) -> dict[str, Any]:
    metric_snapshot = metrics.get_metrics()
    policy = load_observability_alert_policy(session)
    guard_overrides = load_provider_guard_overrides(session)
    provider_alerts = build_provider_alerts(metric_snapshot, policy)
    provider_reliability = apply_provider_guard_overrides(
        build_provider_reliability(metric_snapshot, policy),
        guard_overrides,
    )
    training_queue = get_queue_stats(session)
    normative_status = NormativeRetrievalService.get_status()
    contracts = list_prompt_contracts()

    return {
        "training_queue": training_queue,
        "normative_retrieval": normative_status,
        "prompt_contracts_count": len(contracts),
        "metrics": metric_snapshot,
        "provider_alert_policy": policy,
        "provider_alerts": provider_alerts,
        "provider_reliability": provider_reliability,
        "provider_guard_overrides": guard_overrides,
    }


def _build_observability_csv(snapshot: dict[str, Any]) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["section", "provider", "metric", "value", "threshold", "level", "code", "message"])

    policy = snapshot.get("provider_alert_policy") or {}
    for key, value in policy.items():
        writer.writerow(["policy", "", key, value, "", "", "", ""])

    guard_overrides = snapshot.get("provider_guard_overrides") or {}
    for provider, override in guard_overrides.items():
        writer.writerow(
            [
                "guard_override",
                provider,
                "force_disabled",
                str(bool(override.get("force_disabled"))).lower(),
                "",
                "",
                "",
                (override.get("reason") or ""),
            ]
        )

    provider_reliability = snapshot.get("provider_reliability") or {}
    for provider, item in provider_reliability.items():
        writer.writerow(
            [
                "reliability",
                provider,
                "status",
                item.get("status") or "",
                "",
                "",
                ",".join(item.get("flags") or []),
                item.get("reason") or "",
            ]
        )
        writer.writerow(
            [
                "reliability",
                provider,
                "available",
                str(bool(item.get("available"))).lower(),
                "",
                "",
                "",
                "",
            ]
        )

    generators = (snapshot.get("metrics") or {}).get("generators") or {}
    by_provider = generators.get("by_provider") or {}
    outcomes_by_provider = generators.get("outcomes_by_provider") or {}
    avg_latency_by_provider = generators.get("avg_latency_ms_by_provider") or {}
    for provider in sorted(by_provider.keys()):
        writer.writerow(["provider", provider, "requests", safe_int(by_provider.get(provider), 0), "", "", "", ""])
        outcomes = outcomes_by_provider.get(provider) or {}
        for outcome_key in ("success", "empty", "timeout", "dns_error", "provider_error"):
            writer.writerow(
                [
                    "provider",
                    provider,
                    outcome_key,
                    safe_int(outcomes.get(outcome_key), 0),
                    "",
                    "",
                    "",
                    "",
                ]
            )
        if provider in avg_latency_by_provider:
            writer.writerow(
                [
                    "provider",
                    provider,
                    "avg_latency_ms",
                    round(safe_float(avg_latency_by_provider.get(provider), 0.0), 2),
                    "",
                    "",
                    "",
                    "",
                ]
            )

    for alert in snapshot.get("provider_alerts") or []:
        threshold = json.dumps(alert.get("threshold") or {}, ensure_ascii=True)
        writer.writerow(
            [
                "alert",
                alert.get("provider") or "",
                "",
                "",
                threshold,
                alert.get("level") or "",
                alert.get("code") or "",
                alert.get("message") or "",
            ]
        )

    return output.getvalue()


# ============ Dashboard ============

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get dashboard statistics."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # User stats
    total_users = session.exec(select(func.count(User.id))).one()
    active_today = session.exec(
        select(func.count(func.distinct(ActivityLog.user_id)))
        .where(ActivityLog.created_at >= today)
    ).one()
    
    # Training item stats
    total_items = session.exec(select(func.count(TrainingItem.id))).one()
    verified = session.exec(
        select(func.count(TrainingItem.id))
        .where(TrainingItem.is_verified == True)
    ).one()
    
    # Document stats
    total_docs = session.exec(select(func.count(Document.id))).one()
    
    # Training job stats
    total_jobs = session.exec(select(func.count(TrainingJob.id))).one()
    latest_job = session.exec(
        select(TrainingJob)
        .where(TrainingJob.status == "completed")
        .order_by(TrainingJob.completed_at.desc())
    ).first()
    
    # Generations today (approximate by log entries)
    generations_today = session.exec(
        select(func.count(ActivityLog.id))
        .where(ActivityLog.created_at >= today)
        .where(ActivityLog.action.like("generate_%"))
    ).one()
    
    return DashboardStats(
        total_users=total_users,
        active_users_today=active_today,
        total_training_items=total_items,
        verified_items=verified,
        pending_items=total_items - verified,
        total_documents=total_docs,
        total_training_jobs=total_jobs,
        latest_model_version=latest_job.version if latest_job else None,
        generations_today=generations_today
    )


# ============ Users ============

@router.get("/users", response_model=List[UserOut])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """List all users."""
    users = session.exec(select(User).offset(skip).limit(limit)).all()
    return [
        UserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            role=u.role.value,
            is_active=u.is_active,
            created_at=u.created_at
        ) for u in users
    ]


@router.post("/users", response_model=UserOut)
async def create_user(
    user_data: UserCreate,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Create a new user."""
    username = user_data.username.strip()
    if not username:
        raise HTTPException(status_code=422, detail="Username cannot be empty")

    # Check if username exists
    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    email = user_data.email.strip() if user_data.email else None
    role = _coerce_user_role(user_data.role)

    user = User(
        username=username,
        email=email or None,
        role=role,
        hashed_password=get_password_hash(user_data.password)
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at
    )


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Update a user."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.email is not None:
        user.email = user_data.email.strip() or None
    if user_data.role is not None:
        user.role = _coerce_user_role(user_data.role)
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password is not None:
        if not user_data.password.strip():
            raise HTTPException(status_code=422, detail="Password cannot be empty")
        user.hashed_password = get_password_hash(user_data.password)
    
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Delete a user."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    from app.services.account_service import delete_user_account

    counts = delete_user_account(session, user)

    return {"message": "User deleted", "deleted": counts}


# ============ Config ============

@router.get("/config", response_model=List[ConfigItem])
async def get_config(
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get all system configuration."""
    configs = session.exec(select(SystemConfig)).all()
    return [ConfigItem(key=c.key, value=c.value) for c in configs]


@router.put("/config/{key}")
async def set_config(
    key: str,
    item: ConfigItem,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Set a configuration value."""
    path_key = key.strip()
    payload_key = item.key.strip()
    if not path_key:
        raise HTTPException(status_code=422, detail="Config key cannot be empty")
    if path_key != payload_key:
        raise HTTPException(
            status_code=422,
            detail="Path key and payload key must match",
        )

    config = session.exec(select(SystemConfig).where(SystemConfig.key == path_key)).first()
    if config:
        config.value = item.value
        config.updated_at = datetime.utcnow()
    else:
        config = SystemConfig(key=path_key, value=item.value)
    
    session.add(config)
    session.commit()
    
    return {"message": f"Config '{path_key}' updated"}


# ============ Logs ============


@router.get("/observability", response_model=ObservabilitySnapshot)
async def get_observability_snapshot(
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    snapshot = _build_observability_snapshot(session)
    queue_runtime = await queue_manager.get_runtime_status()

    return ObservabilitySnapshot(
        queue=queue_runtime,
        training_queue=snapshot["training_queue"],
        normative_retrieval=snapshot["normative_retrieval"],
        prompt_contracts_count=snapshot["prompt_contracts_count"],
        metrics=snapshot["metrics"],
        provider_alert_policy=snapshot["provider_alert_policy"],
        provider_alerts=snapshot["provider_alerts"],
        provider_reliability=snapshot["provider_reliability"],
        provider_guard_overrides=snapshot["provider_guard_overrides"],
    )


@router.get("/observability/export")
async def export_observability_snapshot(
    format: str = Query(default="json"),
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session),
):
    export_format = (format or "json").strip().lower()
    if export_format not in {"json", "csv"}:
        raise HTTPException(status_code=422, detail="Format must be 'json' or 'csv'.")

    snapshot = _build_observability_snapshot(session)
    snapshot["queue"] = await queue_manager.get_runtime_status()

    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    if export_format == "json":
        payload = json.dumps(snapshot, ensure_ascii=True, indent=2).encode("utf-8")
        return StreamingResponse(
            BytesIO(payload),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="edumind-observability-{timestamp}.json"',
                "Cache-Control": "no-store",
            },
        )

    csv_payload = _build_observability_csv(snapshot).encode("utf-8")
    return StreamingResponse(
        BytesIO(csv_payload),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="edumind-observability-{timestamp}.csv"',
            "Cache-Control": "no-store",
        },
    )

@router.get("/navigation-invalid-metrics", response_model=InvalidNavigationMetrics)
async def get_navigation_invalid_metrics(
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get invalid frontend route telemetry for admin."""
    since = datetime.utcnow() - timedelta(days=days)
    sample_size = min(max(limit * 120, 300), 5000)

    logs = session.exec(
        select(ActivityLog)
        .where(ActivityLog.action == "navigation_invalid")
        .where(ActivityLog.created_at >= since)
        .order_by(ActivityLog.created_at.desc())
        .limit(sample_size)
    ).all()

    path_counts: dict[str, int] = defaultdict(int)
    referrer_counts: dict[str, int] = defaultdict(int)
    recent_events: list[InvalidNavigationEvent] = []

    for log in logs:
        payload = {}
        if log.details:
            try:
                payload = json.loads(log.details)
            except Exception:
                payload = {}

        path = str(payload.get("path") or "/desconocida").strip() or "/desconocida"
        path = normalize_navigation_path(path)
        referrer = normalize_referrer_label(payload.get("referrer"))

        path_counts[path] += 1
        referrer_counts[referrer] += 1

        if len(recent_events) < limit:
            recent_events.append(
                InvalidNavigationEvent(
                    created_at=log.created_at,
                    path=path,
                    referrer=referrer,
                    ip_address=mask_ip_address(log.ip_address),
                    user_id=log.user_id,
                )
            )

    top_paths = [
        NavigationMetricItem(key=key, count=count)
        for key, count in sorted(path_counts.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]
    top_referrers = [
        NavigationMetricItem(key=key, count=count)
        for key, count in sorted(referrer_counts.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]

    runtime_total = 0
    runtime_top_paths: list[NavigationMetricItem] = []
    runtime_top_referrers: list[NavigationMetricItem] = []
    try:
        navigation_snapshot = metrics.get_metrics().get("navigation", {})
        runtime_total = int(navigation_snapshot.get("invalid_total", 0))
        runtime_top_paths = [
            NavigationMetricItem(key=key, count=count)
            for key, count in sorted(
                (navigation_snapshot.get("invalid_by_path") or {}).items(),
                key=lambda item: item[1],
                reverse=True,
            )[:limit]
        ]
        runtime_top_referrers = [
            NavigationMetricItem(key=key, count=count)
            for key, count in sorted(
                (navigation_snapshot.get("invalid_by_referrer") or {}).items(),
                key=lambda item: item[1],
                reverse=True,
            )[:limit]
        ]
    except Exception:
        runtime_total = 0
        runtime_top_paths = []
        runtime_top_referrers = []

    return InvalidNavigationMetrics(
        window_days=days,
        total_events=len(logs),
        unique_paths=len(path_counts),
        unique_referrers=len(referrer_counts),
        top_paths=top_paths,
        top_referrers=top_referrers,
        recent_events=recent_events,
        runtime_invalid_total=runtime_total,
        runtime_top_paths=runtime_top_paths,
        runtime_top_referrers=runtime_top_referrers,
    )

@router.get("/logs", response_model=List[LogEntry])
async def get_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    admin: User = Depends(require_admin_from_vpn),
    session: Session = Depends(get_session)
):
    """Get activity logs."""
    query = select(ActivityLog).order_by(ActivityLog.created_at.desc())
    
    if action:
        query = query.where(ActivityLog.action == action)
    if user_id:
        query = query.where(ActivityLog.user_id == user_id)
    
    query = query.offset(skip).limit(limit)
    logs = session.exec(query).all()
    
    # Get usernames
    result = []
    for log in logs:
        username = None
        if log.user_id:
            user = session.get(User, log.user_id)
            username = user.username if user else None
        
        result.append(LogEntry(
            id=log.id,
            user_id=log.user_id,
            username=username,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=mask_ip_address(log.ip_address),
            created_at=log.created_at
        ))
    
    return result
