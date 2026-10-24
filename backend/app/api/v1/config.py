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
    # Dónde se procesan los textos del usuario: en su dispositivo, en un
    # servidor de EDUmind o en un proveedor externo. La UI lo muestra antes
    # de la primera petición a cualquier motor que no sea el dispositivo.
    processing: str = "third_party"  # device | edumind | third_party
    provider: str | None = None
    region: str | None = None


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

# Catálogo de motores. Las descripciones dicen qué modelo es y dónde se
# procesa el texto: es la base del aviso de privacidad del selector.
PUBLIC_ENGINES = [
    {
        "id": "webgpu",
        "name": "Tu dispositivo",
        "color": "bg-green-500",
        "desc": "Llama 3.2 1B en tu navegador. Nada sale de tu equipo (el modelo se descarga una vez).",
        "tier": "local",
        "is_default": True,
        "processing": "device",
        "provider": "WebLLM en el navegador",
        "region": "Tu dispositivo",
    },
    {
        "id": "edumind",
        "name": "EDUmind Cloud Lite",
        "color": "bg-blue-600",
        "desc": "Modelo abierto (Mistral 7B) en un servidor gestionado por EDUmind, con control de capacidad.",
        "tier": "managed",
        "processing": "edumind",
        "provider": "Servidor EDUmind",
        "region": "Unión Europea",
    },
    {
        "id": "chatgpt",
        "name": "ChatGPT (clave propia)",
        "color": "bg-emerald-600",
        "desc": "GPT-4o. Tus textos se envían a OpenAI (EE. UU.) con tu clave.",
        "tier": "byok",
        "requires_api_key": True,
        "processing": "third_party",
        "provider": "OpenAI",
        "region": "Estados Unidos",
    },
    {
        "id": "claude",
        "name": "Claude (clave propia)",
        "color": "bg-purple-600",
        "desc": "Tus textos se envían a Anthropic (EE. UU.) con tu clave.",
        "tier": "byok",
        "requires_api_key": True,
        "processing": "third_party",
        "provider": "Anthropic",
        "region": "Estados Unidos",
    },
    {
        "id": "gemini",
        "name": "Gemini (clave propia)",
        "color": "bg-red-500",
        "desc": "Tus textos se envían a Google (EE. UU.) con tu clave.",
        "tier": "byok",
        "requires_api_key": True,
        "processing": "third_party",
        "provider": "Google",
        "region": "Estados Unidos",
    },
]

PRIVATE_ENGINES = [
    {
        "id": "mistral",
        "name": "Mistral (nube, VPN)",
        "color": "bg-orange-500",
        "desc": "Nube de Mistral AI (Francia, UE) con clave del sistema. Solo VPN/Admin.",
        "tier": "restricted",
        "requires_vpn_or_admin": True,
        "processing": "third_party",
        "provider": "Mistral AI",
        "region": "Unión Europea",
    },
    {
        "id": "ollama",
        "name": "Gemma 4 en servidor EDUmind (VPN)",
        "color": "bg-slate-500",
        "desc": "Gemma 4 E4B por Ollama en el servidor de EDUmind. No sale a terceros. Solo VPN/Admin.",
        "tier": "restricted",
        "requires_vpn_or_admin": True,
        "processing": "edumind",
        "provider": "Servidor EDUmind",
        "region": "Unión Europea",
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
