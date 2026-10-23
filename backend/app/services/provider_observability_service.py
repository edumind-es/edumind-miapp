#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Provider reliability helpers for observability and runtime safeguards."""

from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from app.models import SystemConfig

OBS_ALERT_DEFAULTS = {
    "observability.alerts.dns_error_count": 1,
    "observability.alerts.timeout_count": 2,
    "observability.alerts.failure_rate_percent": 20.0,
    "observability.alerts.min_sample_size": 10,
}


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def load_observability_alert_policy(session: Session) -> dict[str, float]:
    configs = session.exec(
        select(SystemConfig).where(SystemConfig.key.like("observability.alerts.%"))
    ).all()
    config_map = {cfg.key: cfg.value for cfg in configs}

    dns_error_count = safe_int(
        config_map.get("observability.alerts.dns_error_count"),
        OBS_ALERT_DEFAULTS["observability.alerts.dns_error_count"],
    )
    timeout_count = safe_int(
        config_map.get("observability.alerts.timeout_count"),
        OBS_ALERT_DEFAULTS["observability.alerts.timeout_count"],
    )
    min_sample_size = safe_int(
        config_map.get("observability.alerts.min_sample_size"),
        OBS_ALERT_DEFAULTS["observability.alerts.min_sample_size"],
    )
    failure_rate_percent = safe_float(
        config_map.get("observability.alerts.failure_rate_percent"),
        OBS_ALERT_DEFAULTS["observability.alerts.failure_rate_percent"],
    )

    return {
        "dns_error_count": max(1, dns_error_count),
        "timeout_count": max(1, timeout_count),
        "min_sample_size": max(1, min_sample_size),
        "failure_rate_percent": max(1.0, failure_rate_percent),
    }


def build_provider_alerts(metric_snapshot: dict[str, Any], policy: dict[str, float]) -> list[dict]:
    alerts: list[dict] = []
    generators = metric_snapshot.get("generators") or {}
    by_provider = generators.get("by_provider") or {}
    outcomes_by_provider = generators.get("outcomes_by_provider") or {}

    for provider, raw_requests in by_provider.items():
        requests = safe_int(raw_requests, 0)
        outcomes = outcomes_by_provider.get(provider) or {}
        dns_errors = safe_int(outcomes.get("dns_error"), 0)
        timeouts = safe_int(outcomes.get("timeout"), 0)
        provider_errors = safe_int(outcomes.get("provider_error"), 0)
        empty = safe_int(outcomes.get("empty"), 0)
        failures = dns_errors + timeouts + provider_errors + empty
        failure_rate = ((failures / requests) * 100.0) if requests > 0 else 0.0

        if dns_errors >= safe_int(policy.get("dns_error_count"), 1):
            alerts.append(
                {
                    "level": "critical",
                    "code": "dns_error_spike",
                    "provider": provider,
                    "message": (
                        f"{provider}: {dns_errors} errores DNS/red detectados "
                        f"(umbral {safe_int(policy.get('dns_error_count'), 1)})."
                    ),
                    "metrics": {
                        "requests": requests,
                        "dns_error": dns_errors,
                    },
                    "threshold": {
                        "dns_error_count": safe_int(policy.get("dns_error_count"), 1),
                    },
                }
            )

        if timeouts >= safe_int(policy.get("timeout_count"), 1):
            alerts.append(
                {
                    "level": "warning",
                    "code": "timeout_spike",
                    "provider": provider,
                    "message": (
                        f"{provider}: {timeouts} timeouts detectados "
                        f"(umbral {safe_int(policy.get('timeout_count'), 1)})."
                    ),
                    "metrics": {
                        "requests": requests,
                        "timeout": timeouts,
                    },
                    "threshold": {
                        "timeout_count": safe_int(policy.get("timeout_count"), 1),
                    },
                }
            )

        if requests >= safe_int(policy.get("min_sample_size"), 1) and failure_rate >= safe_float(
            policy.get("failure_rate_percent"), 20.0
        ):
            alerts.append(
                {
                    "level": "warning",
                    "code": "failure_rate_degraded",
                    "provider": provider,
                    "message": (
                        f"{provider}: tasa de fallo {failure_rate:.1f}% "
                        f"(umbral {safe_float(policy.get('failure_rate_percent'), 20.0):.1f}%)."
                    ),
                    "metrics": {
                        "requests": requests,
                        "failure_count": failures,
                        "failure_rate_percent": round(failure_rate, 2),
                    },
                    "threshold": {
                        "min_sample_size": safe_int(policy.get("min_sample_size"), 1),
                        "failure_rate_percent": safe_float(policy.get("failure_rate_percent"), 20.0),
                    },
                }
            )

    return alerts


def build_provider_reliability(metric_snapshot: dict[str, Any], policy: dict[str, float]) -> dict[str, dict]:
    generators = metric_snapshot.get("generators") or {}
    by_provider = generators.get("by_provider") or {}
    outcomes_by_provider = generators.get("outcomes_by_provider") or {}
    reliability: dict[str, dict] = {}

    for provider, raw_requests in by_provider.items():
        requests = safe_int(raw_requests, 0)
        outcomes = outcomes_by_provider.get(provider) or {}
        dns_errors = safe_int(outcomes.get("dns_error"), 0)
        timeouts = safe_int(outcomes.get("timeout"), 0)
        provider_errors = safe_int(outcomes.get("provider_error"), 0)
        empty = safe_int(outcomes.get("empty"), 0)
        failures = dns_errors + timeouts + provider_errors + empty
        failure_rate = ((failures / requests) * 100.0) if requests > 0 else 0.0

        status = "healthy"
        available = True
        reason = ""
        flags: list[str] = []

        if dns_errors >= safe_int(policy.get("dns_error_count"), 1):
            status = "unhealthy"
            available = False
            reason = "Conectividad DNS/red degradada."
            flags.append("dns_error_spike")
        elif timeouts >= max(1, safe_int(policy.get("timeout_count"), 2) * 2):
            status = "unhealthy"
            available = False
            reason = "Timeouts sostenidos detectados."
            flags.append("timeout_sustained")
        elif requests >= safe_int(policy.get("min_sample_size"), 1) and failure_rate >= safe_float(
            policy.get("failure_rate_percent"), 20.0
        ):
            status = "degraded"
            available = True
            reason = "Tasa de fallo por encima de umbral."
            flags.append("failure_rate_degraded")
        elif timeouts >= safe_int(policy.get("timeout_count"), 1):
            status = "degraded"
            available = True
            reason = "Timeouts intermitentes detectados."
            flags.append("timeout_spike")

        reliability[provider] = {
            "status": status,
            "available": available,
            "reason": reason,
            "requests": requests,
            "failures": failures,
            "failure_rate_percent": round(failure_rate, 2),
            "flags": flags,
        }

    return reliability


def load_provider_guard_overrides(session: Session) -> dict[str, dict]:
    """
    Read optional provider guard overrides from SystemConfig.

    Keys:
    - observability.guard.provider.<provider>.force_disabled = true|false
    - observability.guard.provider.<provider>.reason = <text>
    """
    rows = session.exec(
        select(SystemConfig).where(SystemConfig.key.like("observability.guard.provider.%"))
    ).all()
    overrides: dict[str, dict] = {}

    prefix = "observability.guard.provider."
    for row in rows:
        key = row.key
        if not key.startswith(prefix):
            continue
        remainder = key[len(prefix) :]
        parts = remainder.split(".", 1)
        if len(parts) != 2:
            continue
        provider, field = parts
        provider = provider.strip().lower()
        field = field.strip().lower()
        if not provider:
            continue
        if provider not in overrides:
            overrides[provider] = {
                "force_disabled": False,
                "reason": "",
            }
        if field == "force_disabled":
            overrides[provider]["force_disabled"] = safe_bool(row.value, False)
        elif field == "reason":
            overrides[provider]["reason"] = (row.value or "").strip()

    return overrides


def apply_provider_guard_overrides(
    provider_reliability: dict[str, dict], guard_overrides: dict[str, dict]
) -> dict[str, dict]:
    merged: dict[str, dict] = {
        provider: dict(data or {})
        for provider, data in (provider_reliability or {}).items()
    }

    for provider, raw_override in (guard_overrides or {}).items():
        override = raw_override or {}
        if provider not in merged:
            merged[provider] = {
                "status": "healthy",
                "available": True,
                "reason": "",
                "requests": 0,
                "failures": 0,
                "failure_rate_percent": 0.0,
                "flags": [],
            }

        current = dict(merged[provider])
        flags = list(current.get("flags") or [])
        force_disabled = safe_bool(override.get("force_disabled"), False)
        reason = (override.get("reason") or "").strip()

        if force_disabled:
            current["status"] = "forced_disabled"
            current["available"] = False
            current["reason"] = reason or "Proveedor deshabilitado manualmente por operación."
            if "forced_disabled" not in flags:
                flags.append("forced_disabled")
            current["flags"] = flags
        else:
            if "forced_disabled" in flags:
                flags = [flag for flag in flags if flag != "forced_disabled"]
                current["flags"] = flags

        merged[provider] = current

    return merged
