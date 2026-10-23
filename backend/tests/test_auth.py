#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from uuid import uuid4

from sqlmodel import Session, select

from app.api.v1 import auth as auth_module
from app.core.config import settings
from app.db import engine
from app.models import User, UserRole


def _runtime_local_login_enabled() -> bool:
    if settings.AUTH_LOCAL_LOGIN_ENABLED is not None:
        return settings.AUTH_LOCAL_LOGIN_ENABLED
    return settings.AUTH_MODE != "authentik"


def test_login_with_invalid_credentials_matches_runtime_auth_mode(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/auth/login",
        data={"username": "invalid_user", "password": "wrong_password"},
    )

    if _runtime_local_login_enabled():
        assert response.status_code == 401
    else:
        assert response.status_code == 405
        assert response.json()["detail"] == "Local login is disabled. Use EDUmind SSO."


def test_login_with_missing_fields_returns_422(client, api_v1_prefix):
    response = client.post(f"{api_v1_prefix}/auth/login", data={})

    assert response.status_code == 422


def test_me_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/auth/me")

    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client, api_v1_prefix):
    response = client.get(
        f"{api_v1_prefix}/auth/me",
        headers={"Authorization": "Bearer invalid_token_here"},
    )

    assert response.status_code == 401


def test_admin_stats_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/admin/stats")

    assert response.status_code == 401


def test_admin_navigation_invalid_metrics_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/admin/navigation-invalid-metrics")

    assert response.status_code == 401


def test_admin_observability_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/admin/observability")

    assert response.status_code == 401


def test_admin_observability_export_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/admin/observability/export")

    assert response.status_code == 401


def test_queue_runtime_without_token_returns_401(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/queue/runtime")

    assert response.status_code == 401


def test_health_providers_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/health/providers")

    assert response.status_code == 403


def test_metrics_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/metrics")

    assert response.status_code == 403


def test_knowledge_document_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/knowledge/document/legislacion/lomloe")

    assert response.status_code == 403


def test_knowledge_categories_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/knowledge/categories")

    assert response.status_code == 403


def test_knowledge_documents_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/knowledge/documents")

    assert response.status_code == 403


def test_knowledge_search_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/knowledge/search", params={"query": "lomloe"})

    assert response.status_code == 403


def test_prompt_contracts_without_admin_or_vpn_returns_403(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/generators/prompt-contracts")

    assert response.status_code == 403


def test_auth_config_reflects_runtime_settings(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/auth/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_mode"] == settings.AUTH_MODE
    assert payload["local_login_enabled"] is _runtime_local_login_enabled()
    assert payload["sso_enabled"] is (settings.AUTH_MODE == "authentik")
    if settings.AUTH_MODE == "authentik":
        assert payload["sso_provider"] == "authentik"
        assert payload["sso_login_path"] == f"{api_v1_prefix}/auth/sso/login"
    else:
        assert payload["sso_enabled"] is False
        assert payload["sso_login_path"] is None


def test_local_login_disabled_when_sso_is_enabled(client, api_v1_prefix, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_MODE", "authentik")
    monkeypatch.setattr(settings, "AUTH_LOCAL_LOGIN_ENABLED", False)

    response = client.post(
        f"{api_v1_prefix}/auth/login",
        data={"username": "admin", "password": "admin"},
    )

    assert response.status_code == 405
    assert response.json()["detail"] == "Local login is disabled. Use EDUmind SSO."


def test_sso_callback_provisions_user_and_sets_session(client, api_v1_prefix, monkeypatch):
    async def fake_fetch_oidc_metadata():
        return {
            "authorization_endpoint": "https://auth.edumind.es/application/o/authorize/",
            "token_endpoint": "https://auth.edumind.es/application/o/token/",
            "userinfo_endpoint": "https://auth.edumind.es/application/o/userinfo/",
            "end_session_endpoint": "https://auth.edumind.es/application/o/end-session/",
        }

    async def fake_exchange_oidc_authorization_code(code: str, code_verifier: str, redirect_uri: str):
        assert code == "demo-code"
        assert code_verifier == "demo-verifier"
        assert redirect_uri.endswith("/api/v1/auth/sso/callback")
        return {"access_token": "demo-access-token"}

    async def fake_fetch_oidc_userinfo(access_token: str):
        assert access_token == "demo-access-token"
        return {
            "sub": "authentik-demo-subject",
            "email": "admin.sso@example.com",
            "preferred_username": "admin.sso",
            "groups": ["edumind-admin"],
        }

    monkeypatch.setattr(settings, "AUTH_MODE", "authentik")
    monkeypatch.setattr(settings, "AUTH_LOCAL_LOGIN_ENABLED", False)
    monkeypatch.setattr(auth_module, "fetch_oidc_metadata", fake_fetch_oidc_metadata)
    monkeypatch.setattr(auth_module, "exchange_oidc_authorization_code", fake_exchange_oidc_authorization_code)
    monkeypatch.setattr(auth_module, "fetch_oidc_userinfo", fake_fetch_oidc_userinfo)

    client.cookies.set(auth_module._SSO_STATE_COOKIE_NAME, "demo-state")
    client.cookies.set(auth_module._SSO_CODE_VERIFIER_COOKIE_NAME, "demo-verifier")
    client.cookies.set(auth_module._SSO_NEXT_COOKIE_NAME, "/admin")

    response = client.get(
        f"{api_v1_prefix}/auth/sso/callback",
        params={"code": "demo-code", "state": "demo-state"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == settings.ADMIN_PORTAL_PATH
    assert settings.AUTH_COOKIE_NAME in response.cookies

    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.oidc_subject == "authentik-demo-subject")
        ).one()

    assert user.username == "admin.sso"
    assert user.email == "admin.sso@example.com"
    assert user.role.value == "admin"
    assert user.auth_provider == "authentik"


def test_admin_endpoints_require_vpn_even_with_admin_session(client, api_v1_prefix):
    username = f"admin-vpn-{uuid4().hex[:8]}"
    with Session(engine) as session:
        user = User(
            username=username,
            email=f"{username}@example.com",
            role=UserRole.ADMIN,
            hashed_password=auth_module.get_password_hash("temporary-password"),
            is_active=True,
        )
        session.add(user)
        session.commit()

    try:
        token = auth_module.create_access_token({"sub": username})
        headers = {"Authorization": f"Bearer {token}"}

        admin_response = client.get(f"{api_v1_prefix}/admin/stats", headers=headers)
        assert admin_response.status_code == 403
        assert admin_response.json()["detail"] == "Admin access requires VPN/local network."

        admin_surface_response = client.get(f"{api_v1_prefix}/auth/admin-surface", headers=headers)
        assert admin_surface_response.status_code == 403
        assert admin_surface_response.json()["detail"] == "Admin access requires VPN/local network."

        training_response = client.get(f"{api_v1_prefix}/training/models", headers=headers)
        assert training_response.status_code == 403
        assert training_response.json()["detail"] == "Admin access requires VPN/local network."
    finally:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if user:
                session.delete(user)
                session.commit()


def test_default_destination_hides_admin_path_outside_vpn(client, api_v1_prefix):
    username = f"admin-destination-{uuid4().hex[:8]}"
    with Session(engine) as session:
        user = User(
            username=username,
            email=f"{username}@example.com",
            role=UserRole.ADMIN,
            hashed_password=auth_module.get_password_hash("temporary-password"),
            is_active=True,
        )
        session.add(user)
        session.commit()

    try:
        token = auth_module.create_access_token({"sub": username})
        response = client.get(
            f"{api_v1_prefix}/auth/default-destination",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["path"] == "/dashboard"
    finally:
        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == username)).first()
            if user:
                session.delete(user)
                session.commit()
