#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#


import json

from sqlmodel import Session, select

from app.db import engine
from app.models import ActivityLog


def test_normative_status_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/normative/status")

    assert response.status_code == 403


def test_normative_search_supports_pagination(client, api_v1_prefix):
    response = client.get(
        f"{api_v1_prefix}/normative/search",
        params={"query": "acoso escolar", "page": 1, "page_size": 3},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "acoso escolar"
    assert payload["page"] == 1
    assert payload["page_size"] == 3
    assert "total_results" in payload
    assert "total_pages" in payload
    assert "results" in payload
    assert len(payload["results"]) <= 3
    assert "context" in payload


def test_telemetry_invalid_navigation_accepts_public_events(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/telemetry/navigation-invalid",
        json={
            "path": "/ruta/123/inexistente?token=abc#frag",
            "referrer": "https://example.org/origen/999?foo=bar",
            "user_agent": "Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36",
            "route_scope": "frontend",
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"

    with Session(engine) as session:
        log = session.exec(
            select(ActivityLog)
            .where(ActivityLog.action == "navigation_invalid")
            .order_by(ActivityLog.id.desc())
        ).first()

    assert log is not None
    payload = json.loads(log.details or "{}")
    assert payload["path"] == "/ruta/:id/inexistente?query#fragment"
    assert payload["referrer"] == "https://example.org/origen/:id"
    assert payload["user_agent_family"] == "chrome"
