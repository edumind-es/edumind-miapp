#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.api.v1.admin import _build_observability_csv
from app.services.provider_observability_service import (
    apply_provider_guard_overrides,
    build_provider_alerts,
    build_provider_reliability,
)


def test_build_provider_alerts_detects_dns_timeout_and_failure_rate():
    metric_snapshot = {
        "generators": {
            "by_provider": {"gemini": 10},
            "outcomes_by_provider": {
                "gemini": {
                    "success": 5,
                    "dns_error": 2,
                    "timeout": 2,
                    "provider_error": 1,
                    "empty": 0,
                }
            },
        }
    }
    policy = {
        "dns_error_count": 1,
        "timeout_count": 2,
        "failure_rate_percent": 20.0,
        "min_sample_size": 10,
    }

    alerts = build_provider_alerts(metric_snapshot, policy)
    codes = {alert["code"] for alert in alerts}

    assert "dns_error_spike" in codes
    assert "timeout_spike" in codes
    assert "failure_rate_degraded" in codes


def test_build_observability_csv_contains_policy_provider_and_alert_rows():
    snapshot = {
        "provider_alert_policy": {
            "dns_error_count": 1,
            "timeout_count": 2,
            "failure_rate_percent": 20.0,
            "min_sample_size": 10,
        },
        "metrics": {
            "generators": {
                "by_provider": {"edumind": 3},
                "outcomes_by_provider": {"edumind": {"success": 3}},
                "avg_latency_ms_by_provider": {"edumind": 245.5},
            }
        },
        "provider_alerts": [
            {
                "level": "warning",
                "code": "timeout_spike",
                "provider": "edumind",
                "message": "Timeouts detectados",
                "threshold": {"timeout_count": 2},
            }
        ],
    }

    csv_text = _build_observability_csv(snapshot)

    assert "section,provider,metric,value,threshold,level,code,message" in csv_text
    assert "policy,,dns_error_count,1" in csv_text
    assert "provider,edumind,requests,3" in csv_text
    assert "alert,edumind" in csv_text
    assert "timeout_spike" in csv_text


def test_build_provider_reliability_marks_provider_unhealthy_on_dns_spike():
    metric_snapshot = {
        "generators": {
            "by_provider": {"edumind": 8},
            "outcomes_by_provider": {
                "edumind": {
                    "success": 3,
                    "dns_error": 2,
                    "timeout": 0,
                    "provider_error": 0,
                    "empty": 0,
                }
            },
        }
    }
    policy = {
        "dns_error_count": 1,
        "timeout_count": 2,
        "failure_rate_percent": 20.0,
        "min_sample_size": 10,
    }

    reliability = build_provider_reliability(metric_snapshot, policy)
    edumind = reliability["edumind"]

    assert edumind["available"] is False
    assert edumind["status"] == "unhealthy"
    assert "dns_error_spike" in edumind["flags"]


def test_apply_provider_guard_overrides_forces_disabled_state():
    reliability = {
        "edumind": {
            "status": "healthy",
            "available": True,
            "reason": "",
            "flags": [],
        }
    }
    overrides = {
        "edumind": {
            "force_disabled": True,
            "reason": "Mantenimiento programado",
        }
    }

    merged = apply_provider_guard_overrides(reliability, overrides)

    assert merged["edumind"]["status"] == "forced_disabled"
    assert merged["edumind"]["available"] is False
    assert merged["edumind"]["reason"] == "Mantenimiento programado"
    assert "forced_disabled" in merged["edumind"]["flags"]
