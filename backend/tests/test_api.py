#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.core.queue_manager import QueueStatus


def test_root_exposes_docs_link(client):
    response = client.get("/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "Welcome to EDUMind MiApp API"
    assert payload["docs"] == "/docs"


def test_health_endpoint_returns_public_minimal_payload(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health")

    assert response.status_code == 200
    payload = response.json()
    assert "status" in payload
    assert "checks" not in payload


def test_health_public_endpoint_returns_public_minimal_payload(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/public")

    assert response.status_code == 200
    payload = response.json()
    assert "status" in payload
    assert "timestamp" in payload
    assert "version" in payload
    assert "checks" not in payload


def test_simple_health_endpoint_returns_ok(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/simple")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_providers_endpoint_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/providers")

    assert response.status_code == 403


def test_health_dependencies_endpoint_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/dependencies")

    assert response.status_code == 403


def test_health_internal_endpoint_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/internal")

    assert response.status_code == 403


def test_health_slo_endpoint_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/slo")

    assert response.status_code == 403


def test_normative_curriculum_catalog_returns_galicia_primary_baseline(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/normative/curriculum/galicia/primary")

    assert response.status_code == 200
    payload = response.json()
    assert payload["region"] == "Galicia"
    assert payload["stage"] == "Educacion Primaria"
    assert isinstance(payload["areas"], list)
    assert len(payload["areas"]) >= 6
    first_area = payload["areas"][0]
    assert "area_id" in first_area
    assert "area_name" in first_area
    assert isinstance(first_area["contents"], list)
    assert len(first_area["contents"]) >= 5


def test_chat_completions_rejects_invalid_payload(client, api_v1_prefix):
    response = client.post(f"{api_v1_prefix}/chat/completions", json={"message": "test"})

    assert response.status_code == 422


def test_chat_completions_rejects_unknown_provider(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/chat/completions",
        json={
            "provider": "unknown-provider",
            "messages": [{"role": "user", "content": "Hola"}],
        },
    )

    assert response.status_code == 400


def test_chat_completions_managed_provider_does_not_require_byok_key(client, api_v1_prefix):
    very_large_prompt = "a" * 12000
    response = client.post(
        f"{api_v1_prefix}/chat/completions",
        json={
            "provider": "edumind",
            "messages": [{"role": "user", "content": very_large_prompt}],
        },
    )

    # Managed provider should be admission-controlled and never treated as BYOK-only/restricted.
    assert response.status_code in {413, 429, 503}
    assert response.status_code != 402
    assert response.status_code != 403


def test_chat_byok_provider_without_key_does_not_reserve_queue_slot(client, api_v1_prefix, monkeypatch):
    reserve_calls = 0

    async def _reserve_slot(*_args, **_kwargs):
        nonlocal reserve_calls
        reserve_calls += 1
        return QueueStatus(
            is_active=True,
            position=0,
            estimated_wait_seconds=0,
            message="Connected",
            backend="memory",
        )

    monkeypatch.setattr("app.api.v1.chat.queue_manager.reserve_slot", _reserve_slot)

    response = client.post(
        f"{api_v1_prefix}/chat/completions",
        json={
            "provider": "chatgpt",
            "messages": [{"role": "user", "content": "Hola"}],
        },
    )

    assert response.status_code == 402
    assert reserve_calls == 0


def test_chat_restricted_provider_denied_before_queue_reservation(client, api_v1_prefix, monkeypatch):
    reserve_calls = 0

    async def _reserve_slot(*_args, **_kwargs):
        nonlocal reserve_calls
        reserve_calls += 1
        return QueueStatus(
            is_active=True,
            position=0,
            estimated_wait_seconds=0,
            message="Connected",
            backend="memory",
        )

    monkeypatch.setattr("app.api.v1.chat.queue_manager.reserve_slot", _reserve_slot)
    monkeypatch.setattr("app.api.v1.chat.is_vpn_or_local_request", lambda _request: False)

    response = client.post(
        f"{api_v1_prefix}/chat/completions",
        json={
            "provider": "ollama",
            "messages": [{"role": "user", "content": "Hola"}],
        },
    )

    assert response.status_code == 403
    assert reserve_calls == 0
