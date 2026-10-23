#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#

"""Anonymous session cookie utilities (signed token)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import Request, Response

from app.core.config import settings


def _cookie_secure() -> bool:
    return settings.SESSION_COOKIE_SECURE and not settings.DEBUG


def _cookie_samesite() -> str:
    return settings.SESSION_COOKIE_SAMESITE.lower()


def _build_cookie_kwargs() -> dict:
    return {
        "max_age": settings.ANON_SESSION_COOKIE_MAX_AGE_SECONDS,
        "path": "/",
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
    }


def _sign_value(raw: str) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest


def build_signed_anonymous_token(raw: Optional[str] = None) -> str:
    seed = raw or secrets.token_urlsafe(18)
    signature = _sign_value(seed)
    return f"{seed}.{signature}"


def verify_signed_anonymous_token(token: str) -> Optional[str]:
    if not token or "." not in token:
        return None
    raw, signature = token.rsplit(".", 1)
    if not raw or not signature:
        return None
    expected = _sign_value(raw)
    if not hmac.compare_digest(signature, expected):
        return None
    return raw


def get_anonymous_subject(request: Request) -> Optional[str]:
    token = request.cookies.get(settings.ANON_SESSION_COOKIE_NAME)
    if not token:
        return None
    return verify_signed_anonymous_token(token)


def ensure_anonymous_cookie(request: Request, response: Response):
    # Authenticated users don't need anonymous identity cookie.
    if request.cookies.get(settings.AUTH_COOKIE_NAME):
        return

    token = request.cookies.get(settings.ANON_SESSION_COOKIE_NAME)
    if token and verify_signed_anonymous_token(token):
        return

    signed = build_signed_anonymous_token()
    response.set_cookie(
        key=settings.ANON_SESSION_COOKIE_NAME,
        value=signed,
        httponly=True,
        **_build_cookie_kwargs(),
    )

