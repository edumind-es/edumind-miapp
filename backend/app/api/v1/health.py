#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Health Check API - Detailed system health monitoring."""
import os
import math
import socket
import time
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query, Request
import httpx
from pydantic import BaseModel
from app.api.v1.auth import get_current_user_optional, require_admin_or_vpn
from app.core.config import settings
from app.core.queue_manager import queue_manager
from app.core.security import is_vpn_or_local_request
from app.models import User, UserRole
from app.services.metrics_service import metrics

router = APIRouter()
_PROVIDER_HEALTH_TTL_SECONDS = 20.0
_provider_health_cache_payload: dict | None = None
_provider_health_cache_expires_at = 0.0


class ProviderHealthItem(BaseModel):
    status: str
    available: bool
    reason: str | None = None
    fallback: list[str] = []
    dns_ok: bool = False
    tls_ok: bool = False
    http_ok: bool = False
    http_status: int | None = None
    auth_required: bool = False
    connection_scope: str = "network-only"
    api_key_validated: bool = False
    checked_at: str


class ProvidersHealthResponse(BaseModel):
    timestamp: str
    cached: bool
    providers: dict[str, ProviderHealthItem]


class PublicHealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


class DependencyHealthResponse(BaseModel):
    status: str
    timestamp: str
    checks: dict


class InternalHealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    checks: dict
    queue: dict
    providers_cached: bool
    providers: dict[str, ProviderHealthItem]
    slo_targets: dict[str, float | int]


async def _resolve_dns_quick(hostname: str, timeout_seconds: float = 2.5) -> tuple[bool, str | None]:
    if not hostname:
        return False, "hostname vacío"
    try:
        await asyncio.wait_for(
            asyncio.to_thread(socket.getaddrinfo, hostname, None),
            timeout=timeout_seconds,
        )
        return True, None
    except Exception as exc:
        return False, str(exc)


async def _probe_tls_quick(hostname: str, port: int = 443, timeout_seconds: float = 3.0) -> tuple[bool, str | None]:
    if not hostname:
        return False, "hostname vacío"
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host=hostname, port=port, ssl=True, server_hostname=hostname),
            timeout=timeout_seconds,
        )
        writer.close()
        await writer.wait_closed()
        _ = reader
        return True, None
    except Exception as exc:
        detail = str(exc).strip() or exc.__class__.__name__
        return False, detail


async def _probe_http_quick(url: str, timeout_seconds: float = 4.0) -> tuple[bool, int | None, str | None]:
    if not url:
        return False, None, "url vacía"
    timeout = httpx.Timeout(timeout_seconds, connect=2.0, read=2.5, write=2.0, pool=2.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "EDUmind-Connectivity-Probe/1.0"})
        status = int(response.status_code)
        # Reachability check only (not API authorization).
        if status < 500 or status in {500, 502, 503, 504}:
            return True, status, None
        return False, status, f"HTTP {status}"
    except Exception as exc:
        detail = str(exc).strip() or exc.__class__.__name__
        return False, None, detail


async def _build_providers_health_snapshot() -> dict[str, ProviderHealthItem]:
    checked_at = datetime.utcnow().isoformat()
    providers: dict[str, ProviderHealthItem] = {
        "webgpu": ProviderHealthItem(
            status="client-dependent",
            available=True,
            reason="Depende de soporte WebGPU del dispositivo.",
            fallback=["edumind", "gemini", "chatgpt", "deepseek", "claude"],
            dns_ok=True,
            tls_ok=True,
            http_ok=True,
            auth_required=False,
            connection_scope="client-runtime",
            api_key_validated=False,
            checked_at=checked_at,
        )
    }

    host_checks = {
        "gemini": {"host": "generativelanguage.googleapis.com", "probe_url": "https://generativelanguage.googleapis.com/", "auth_required": True},
        "chatgpt": {"host": "api.openai.com", "probe_url": "https://api.openai.com/v1/models", "auth_required": True},
        "deepseek": {"host": "api.deepseek.com", "probe_url": "https://api.deepseek.com/", "auth_required": True},
        "claude": {"host": "api.anthropic.com", "probe_url": "https://api.anthropic.com/", "auth_required": True},
    }

    edumind_core_url = (settings.EDUMIND_CORE_URL or "").strip()
    edumind_core_token = (settings.EDUMIND_CORE_TOKEN or "").strip()
    edumind_hostname = urlparse(edumind_core_url).hostname if edumind_core_url else None
    if not edumind_core_url or not edumind_core_token or not edumind_hostname:
        providers["edumind"] = ProviderHealthItem(
            status="unavailable",
            available=False,
            reason="EDUmind Cloud Lite no configurado correctamente.",
            fallback=["webgpu", "gemini", "chatgpt", "deepseek", "claude"],
            dns_ok=False,
            tls_ok=False,
            http_ok=False,
            auth_required=False,
            connection_scope="network-only",
            api_key_validated=False,
            checked_at=checked_at,
        )
    else:
        host_checks["edumind"] = {
            "host": edumind_hostname,
            "probe_url": edumind_core_url,
            "auth_required": False,
        }

    checks = await asyncio.gather(
        *[_resolve_dns_quick(str(provider_data["host"])) for provider_data in host_checks.values()],
        return_exceptions=False,
    )
    tls_checks = await asyncio.gather(
        *[
            _probe_tls_quick(
                str(provider_data["host"]),
                443,
            )
            if dns_ok
            else asyncio.sleep(0, result=(False, "DNS no resuelto"))
            for provider_data, (dns_ok, _dns_reason) in zip(host_checks.values(), checks)
        ],
        return_exceptions=False,
    )
    http_checks = await asyncio.gather(
        *[
            _probe_http_quick(str(provider_data["probe_url"]))
            if dns_ok and tls_ok
            else asyncio.sleep(0, result=(False, None, "TLS/DNS no disponible"))
            for provider_data, (dns_ok, _dns_reason), (tls_ok, _tls_reason) in zip(
                host_checks.values(), checks, tls_checks
            )
        ],
        return_exceptions=False,
    )

    for provider_id, (dns_ok, dns_reason), (tls_ok, tls_reason), (http_ok, http_status, http_reason) in zip(
        host_checks.keys(), checks, tls_checks, http_checks
    ):
        provider_meta = host_checks[provider_id]
        auth_required = bool(provider_meta["auth_required"])
        reason_parts = []
        if not dns_ok:
            reason_parts.append(f"Sin conectividad DNS/red ({dns_reason}).")
        if dns_ok and not tls_ok:
            reason_parts.append(f"Sin conexión TLS saliente ({tls_reason}).")
        if dns_ok and tls_ok and not http_ok:
            reason_parts.append(f"Sin reachability HTTP ({http_reason}).")

        is_available = bool(dns_ok and tls_ok and http_ok)
        if is_available:
            reason = (
                "Conectividad de red operativa. "
                "Validación de credenciales API no realizada en este test."
            )
        else:
            reason = " ".join(reason_parts) if reason_parts else "Conectividad de red no disponible."

        fallback = ["webgpu"]
        if provider_id == "edumind":
            fallback = ["webgpu", "gemini", "chatgpt", "deepseek", "claude"]

        if dns_ok:
            providers[provider_id] = ProviderHealthItem(
                status="available" if is_available else "degraded",
                available=is_available,
                reason=reason,
                fallback=fallback,
                dns_ok=dns_ok,
                tls_ok=tls_ok,
                http_ok=http_ok,
                http_status=http_status,
                auth_required=auth_required,
                connection_scope="network-only",
                api_key_validated=False,
                checked_at=checked_at,
            )
        else:
            providers[provider_id] = ProviderHealthItem(
                status="unavailable",
                available=False,
                reason=reason,
                fallback=fallback,
                dns_ok=dns_ok,
                tls_ok=tls_ok,
                http_ok=http_ok,
                http_status=http_status,
                auth_required=auth_required,
                connection_scope="network-only",
                api_key_validated=False,
                checked_at=checked_at,
            )

    return providers


async def _get_cached_providers_health(force_refresh: bool = False) -> tuple[bool, dict[str, ProviderHealthItem]]:
    global _provider_health_cache_payload, _provider_health_cache_expires_at
    now = time.monotonic()
    if not force_refresh and _provider_health_cache_payload is not None and now < _provider_health_cache_expires_at:
        return True, _provider_health_cache_payload

    snapshot = await _build_providers_health_snapshot()
    _provider_health_cache_payload = snapshot
    _provider_health_cache_expires_at = now + _PROVIDER_HEALTH_TTL_SECONDS
    return False, snapshot


def check_database() -> dict:
    """Check database connectivity."""
    try:
        from app.db import get_session
        from sqlmodel import select, text
        
        session = next(get_session())
        session.exec(text("SELECT 1"))
        return {"status": "healthy", "message": "Database connected"}
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


def check_knowledge_base() -> dict:
    """Check knowledge base directory."""
    try:
        kb_path = Path(__file__).resolve().parent.parent.parent.parent / "knowledge"
        if not kb_path.exists():
            return {"status": "warning", "message": "Knowledge directory missing"}
        
        doc_count = sum(1 for _ in kb_path.rglob("*.md"))
        return {
            "status": "healthy",
            "message": f"Knowledge base OK ({doc_count} documents)"
        }
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


async def check_ollama() -> dict:
    """Check local Ollama service (optional)."""
    try:
        ollama_url = settings.OLLAMA_URL
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{ollama_url.replace('/api/chat', '')}/")
        if response.status_code == 200:
            return {"status": "healthy", "message": "Ollama running"}
        return {"status": "warning", "message": f"Ollama returned {response.status_code}"}
    except Exception:
        return {"status": "unavailable", "message": "Ollama not running (optional)"}


def check_disk_space() -> dict:
    """Check available disk space."""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/var/www/edumind_miapp")
        free_gb = free / (1024 ** 3)
        used_percent = (used / total) * 100
        
        status = "healthy"
        if free_gb < 1:
            status = "critical"
        elif free_gb < 5:
            status = "warning"
        
        return {
            "status": status,
            "message": f"{free_gb:.1f} GB free ({used_percent:.1f}% used)"
        }
    except Exception as e:
        return {"status": "unknown", "message": str(e)}


async def _build_component_checks() -> dict[str, dict]:
    return {
        "database": check_database(),
        "knowledge_base": check_knowledge_base(),
        "ollama": await check_ollama(),
        "disk_space": check_disk_space(),
    }


def _determine_overall_health(checks: dict[str, dict]) -> str:
    statuses = [c["status"] for c in checks.values()]
    if "critical" in statuses or statuses.count("unhealthy") > 1:
        return "unhealthy"
    if "unhealthy" in statuses or "warning" in statuses:
        return "degraded"
    return "healthy"


async def _build_public_health_payload() -> dict:
    checks = await _build_component_checks()
    return {
        "status": _determine_overall_health(checks),
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
    }


@router.get("/health")
async def health_check(
    request: Request,
    include_checks: bool = Query(
        False,
        description="Incluye checks detallados (solo admin o red local/VPN).",
    ),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Comprehensive health check endpoint.
    
    Returns status of all components:
    - Database connectivity
    - Knowledge base availability
    - Ollama service (optional)
    - Disk space
    """
    checks = await _build_component_checks()
    payload = await _build_public_health_payload()
    is_admin = bool(current_user and current_user.role == UserRole.ADMIN)
    if include_checks and (is_admin or is_vpn_or_local_request(request)):
        payload["checks"] = checks
    return payload


@router.get("/health/simple")
async def health_simple():
    """Simple health check for load balancers."""
    return {"status": "ok"}


@router.get("/health/public", response_model=PublicHealthResponse)
async def health_public():
    """Public minimal health surface for edge/synthetic checks."""
    return await _build_public_health_payload()


@router.get("/health/dependencies", response_model=DependencyHealthResponse)
async def health_dependencies(_guard: User | None = Depends(require_admin_or_vpn)):
    """Protected dependency health snapshot."""
    checks = await _build_component_checks()
    return DependencyHealthResponse(
        status=_determine_overall_health(checks),
        timestamp=datetime.utcnow().isoformat(),
        checks=checks,
    )


@router.get("/health/internal", response_model=InternalHealthResponse)
async def health_internal(_guard: User | None = Depends(require_admin_or_vpn)):
    """Protected operational health for internal dashboards."""
    checks = await _build_component_checks()
    providers_cached, providers = await _get_cached_providers_health(force_refresh=False)
    queue_runtime = await queue_manager.get_runtime_status()
    return InternalHealthResponse(
        status=_determine_overall_health(checks),
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        checks=checks,
        queue=queue_runtime,
        providers_cached=providers_cached,
        providers=providers,
        slo_targets={
            "availability_percent": settings.SLO_TARGET_AVAILABILITY,
            "p95_latency_ms": settings.SLO_TARGET_P95_MS,
        },
    )


@router.get("/health/providers", response_model=ProvidersHealthResponse)
async def get_providers_health(
    refresh: bool = Query(False, description="Forzar recálculo sin caché."),
    _guard: User | None = Depends(require_admin_or_vpn),
):
    """Provider reachability snapshot used by frontend to prevent failing requests."""
    cached, providers = await _get_cached_providers_health(force_refresh=refresh)
    return ProvidersHealthResponse(
        timestamp=datetime.utcnow().isoformat(),
        cached=cached,
        providers=providers,
    )


@router.get("/metrics")
async def get_metrics(_guard: User | None = Depends(require_admin_or_vpn)):
    """Get application metrics in JSON format."""
    try:
        return metrics.get_metrics()
    except ImportError:
        return {"error": "Metrics service not available"}


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = int(math.ceil((pct / 100.0) * len(ordered))) - 1
    idx = min(max(idx, 0), len(ordered) - 1)
    return float(ordered[idx])


@router.get("/health/slo")
async def get_slo_health(_guard: User | None = Depends(require_admin_or_vpn)):
    """SLO-oriented observability snapshot."""
    snapshot = metrics.get_metrics()
    total_requests = int(snapshot.get("requests", {}).get("total", 0))
    total_errors = sum(int(v) for v in snapshot.get("requests", {}).get("errors", {}).values())
    availability = 100.0
    if total_requests > 0:
        availability = 100.0 * (1.0 - (total_errors / total_requests))

    request_times = []
    for endpoint_times in metrics.request_times.values():
        request_times.extend(endpoint_times)
    p95_ms = _percentile(request_times, 95)

    queue_runtime = await queue_manager.get_runtime_status()
    meets_availability = availability >= settings.SLO_TARGET_AVAILABILITY
    meets_latency = p95_ms <= settings.SLO_TARGET_P95_MS

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "slo_targets": {
            "availability_percent": settings.SLO_TARGET_AVAILABILITY,
            "p95_latency_ms": settings.SLO_TARGET_P95_MS,
        },
        "current": {
            "availability_percent": round(availability, 3),
            "p95_latency_ms": round(p95_ms, 3),
            "total_requests": total_requests,
            "total_errors": total_errors,
        },
        "queue": queue_runtime,
        "meets_slo": {
            "availability": meets_availability,
            "latency": meets_latency,
            "overall": meets_availability and meets_latency,
        },
    }


@router.get("/metrics/prometheus")
async def get_prometheus_metrics(_guard: User | None = Depends(require_admin_or_vpn)):
    """Get metrics in Prometheus text format."""
    from fastapi.responses import PlainTextResponse
    try:
        return PlainTextResponse(
            content=metrics.get_prometheus_metrics(),
            media_type="text/plain"
        )
    except ImportError:
        return PlainTextResponse(content="# Metrics service not available")
