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

from fastapi import APIRouter, Request, Depends
from typing import List
from pydantic import BaseModel
from sqlmodel import Session
from app.api.v1.auth import get_current_user_optional, require_admin_or_vpn
from app.models import User, UserRole
from app.core.security import is_vpn_or_local_request
from app.core.queue_manager import queue_manager
from app.db import engine
from app.services.admission_control_service import admission_control
from app.services.metrics_service import metrics
from app.services.provider_observability_service import (
    apply_provider_guard_overrides,
    build_provider_reliability,
    load_observability_alert_policy,
    load_provider_guard_overrides,
)

router = APIRouter()

class EngineConfig(BaseModel):
    id: str
    name: str
    color: str
    desc: str
    tier: str = "general"
    requires_api_key: bool = False
    requires_vpn_or_admin: bool = False
    enabled: bool = True
    reason_disabled: str | None = None
    is_default: bool = False


class RuntimePolicyResponse(BaseModel):
    managed_public_enabled: bool
    load_shed_enabled: bool
    load_shed_queue_utilization: float
    load_shed_min_active: int
    anon_window_seconds: int
    anon_max_requests: int
    anon_cooldown_seconds: int
    anon_max_input_chars: int
    abuse_window_seconds: int
    abuse_challenge_threshold: int
    queue_active_sessions: int
    queue_max_concurrent_users: int
    queue_utilization: float
    provider_reliability: dict[str, dict]
    provider_guard_overrides: dict[str, dict]
    recommended_engine: str

# Defined Engines
PUBLIC_ENGINES = [
    {
        "id": "webgpu",
        "name": "Tu Dispositivo",
        "color": "bg-green-500",
        "desc": "Privado (WebGPU) - Gratis",
        "tier": "local",
        "is_default": True,
    },
    {
        "id": "edumind",
        "name": "EDUmind Cloud Lite",
        "color": "bg-blue-600",
        "desc": "Modelo gestionado con control de capacidad",
        "tier": "managed",
    },
    {
        "id": "chatgpt",
        "name": "ChatGPT (BYOK)",
        "color": "bg-emerald-600",
        "desc": "GPT-4o - OpenAI",
        "tier": "byok",
        "requires_api_key": True,
    },
    {
        "id": "deepseek",
        "name": "DeepSeek (BYOK)",
        "color": "bg-blue-500",
        "desc": "Rendimiento/Coste óptimo",
        "tier": "byok",
        "requires_api_key": True,
    },
    {
        "id": "claude",
        "name": "Claude (BYOK)",
        "color": "bg-purple-600",
        "desc": "Alta capacidad de razonamiento",
        "tier": "byok",
        "requires_api_key": True,
    },
    {
        "id": "gemini",
        "name": "Gemini (BYOK)",
        "color": "bg-red-500",
        "desc": "Multimodal y rápido",
        "tier": "byok",
        "requires_api_key": True,
    },
]

PRIVATE_ENGINES = [
    {
        "id": "mistral",
        "name": "Mistral (VPN)",
        "color": "bg-orange-500",
        "desc": "Acceso Restringido (VPN/Admin)",
        "tier": "restricted",
        "requires_vpn_or_admin": True,
    },
    {
        "id": "ollama",
        "name": "Gemma 4 Local (VPN)",
        "color": "bg-slate-500",
        "desc": "Ollama privado con Gemma 4 E4B (VPN/Admin)",
        "tier": "restricted",
        "requires_vpn_or_admin": True,
    },
]


def _runtime_provider_reliability() -> dict[str, dict]:
    metric_snapshot = metrics.get_metrics()
    with Session(engine) as session:
        policy = load_observability_alert_policy(session)
        guard_overrides = load_provider_guard_overrides(session)
    return apply_provider_guard_overrides(
        build_provider_reliability(metric_snapshot, policy),
        guard_overrides,
    )


def _runtime_provider_guard_overrides() -> dict[str, dict]:
    with Session(engine) as session:
        return load_provider_guard_overrides(session)


@router.get("/engines", response_model=List[EngineConfig])
async def get_engines(
    request: Request,
    current_user: User | None = Depends(get_current_user_optional)
):
    """
    Return available engines based on User Role or Network Location (VPN).
    """
    engines = [dict(item) for item in PUBLIC_ENGINES]
    managed_enabled = admission_control.managed_public_enabled()
    provider_reliability = _runtime_provider_reliability()

    for item in engines:
        if item["id"] == "edumind" and not managed_enabled:
            item["enabled"] = False
            item["reason_disabled"] = "Modo sostenibilidad activo"
            continue

        runtime_provider = provider_reliability.get(item["id"])
        if runtime_provider and runtime_provider.get("available") is False:
            item["enabled"] = False
            item["reason_disabled"] = runtime_provider.get("reason") or "Proveedor degradado"

    # Check Access
    is_admin = current_user and current_user.role == UserRole.ADMIN
    is_vpn = is_vpn_or_local_request(request)
    
    if is_admin or is_vpn:
        # Prepend Private Engines
        engines = [dict(item) for item in PRIVATE_ENGINES] + engines
        
    return engines


@router.get("/runtime-policy", response_model=RuntimePolicyResponse)
async def get_runtime_policy(_guard: User | None = Depends(require_admin_or_vpn)):
    """Expose runtime sustainability policy for UI adaptation."""
    policy = admission_control.get_runtime_policy_snapshot()
    queue_runtime = await queue_manager.get_runtime_status()
    provider_reliability = _runtime_provider_reliability()
    provider_guard_overrides = _runtime_provider_guard_overrides()
    active = int(queue_runtime.get("active_sessions", 0))
    max_users = max(int(queue_runtime.get("max_concurrent_users", 1)), 1)
    utilization = active / max_users

    recommended_engine = "edumind"
    edumind_reliability = provider_reliability.get("edumind")
    if not policy["managed_public_enabled"] or (
        edumind_reliability and edumind_reliability.get("available") is False
    ):
        recommended_engine = "webgpu"

    return RuntimePolicyResponse(
        managed_public_enabled=bool(policy["managed_public_enabled"]),
        load_shed_enabled=bool(policy["load_shed_enabled"]),
        load_shed_queue_utilization=float(policy["load_shed_queue_utilization"]),
        load_shed_min_active=int(policy["load_shed_min_active"]),
        anon_window_seconds=int(policy["anon_window_seconds"]),
        anon_max_requests=int(policy["anon_max_requests"]),
        anon_cooldown_seconds=int(policy["anon_cooldown_seconds"]),
        anon_max_input_chars=int(policy["anon_max_input_chars"]),
        abuse_window_seconds=int(policy["abuse_window_seconds"]),
        abuse_challenge_threshold=int(policy["abuse_challenge_threshold"]),
        queue_active_sessions=active,
        queue_max_concurrent_users=max_users,
        queue_utilization=round(utilization, 3),
        provider_reliability=provider_reliability,
        provider_guard_overrides=provider_guard_overrides,
        recommended_engine=recommended_engine,
    )
