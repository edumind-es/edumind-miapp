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

"""Telemetry API endpoints."""

import json

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from sqlmodel import Session

from app.api.v1.auth import get_current_user_optional
from app.core.security import get_client_ip, get_client_ip_for_log
from app.db import get_session
from app.models import ActivityLog, User
from app.services.metrics_service import (
    classify_user_agent_family,
    metrics,
    normalize_navigation_path,
    normalize_referrer_label,
)

router = APIRouter()


def _telemetry_limit_key(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(key_func=_telemetry_limit_key)


class InvalidNavigationPayload(BaseModel):
    path: str = Field(..., min_length=1, max_length=512)
    referrer: str | None = Field(default=None, max_length=512)
    user_agent: str | None = Field(default=None, max_length=512)
    route_scope: str = Field(default="frontend", max_length=64)


def _normalize_route_scope(route_scope: str | None) -> str:
    normalized = (route_scope or "frontend").strip().lower()
    if not normalized:
        return "frontend"
    return normalized[:64]


@router.post("/navigation-invalid", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
async def track_invalid_navigation(
    request: Request,
    payload: InvalidNavigationPayload,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    safe_path = normalize_navigation_path(payload.path)
    safe_referrer = normalize_referrer_label(payload.referrer)
    safe_route_scope = _normalize_route_scope(payload.route_scope)
    safe_user_agent_family = classify_user_agent_family(payload.user_agent or request.headers.get("user-agent"))

    details = {
        "path": safe_path,
        "referrer": safe_referrer,
        "route_scope": safe_route_scope,
        "user_agent_family": safe_user_agent_family,
    }

    persisted = True
    try:
        event = ActivityLog(
            user_id=current_user.id if current_user else None,
            action="navigation_invalid",
            resource_type="frontend_route",
            details=json.dumps(details, ensure_ascii=True),
            ip_address=get_client_ip_for_log(request),
        )
        db.add(event)
        db.commit()
    except Exception:
        db.rollback()
        persisted = False

    metrics.record_invalid_navigation(safe_path)
    metrics.record_invalid_navigation_referrer(safe_referrer)
    return {"status": "accepted", "persisted": persisted}
