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

"""Authentication API endpoints."""

import base64
import hashlib
import re
import secrets
import time
from datetime import datetime, timedelta
from typing import Literal, Optional
from urllib.parse import urlparse, urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from slowapi import Limiter
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import get_client_ip, is_vpn_or_local_request
from app.db import get_session
from app.models import ActivityLog, User, UserRole

router = APIRouter()

_OIDC_CACHE_TTL_SECONDS = 300
_oidc_metadata_cache: dict[str, object] = {}

_SSO_STATE_COOKIE_NAME = "edumind_sso_state"
_SSO_CODE_VERIFIER_COOKIE_NAME = "edumind_sso_code_verifier"
_SSO_NEXT_COOKIE_NAME = "edumind_sso_next"


def _auth_limit_key(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(key_func=_auth_limit_key)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginResponse(BaseModel):
    token_type: str
    session_auth: str
    user: dict
    csrf_token: str


class LogoutResponse(BaseModel):
    message: str
    logout_url: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: str
    is_active: bool


class AuthConfigResponse(BaseModel):
    auth_mode: str
    local_login_enabled: bool
    sso_enabled: bool
    sso_provider: Optional[str] = None
    sso_login_path: Optional[str] = None


class DefaultDestinationResponse(BaseModel):
    path: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def authenticate_user(session: Session, username: str, password: str) -> Optional[User]:
    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def _cookie_secure() -> bool:
    return settings.SESSION_COOKIE_SECURE and not settings.DEBUG


def _cookie_samesite() -> str:
    return settings.SESSION_COOKIE_SAMESITE.lower()


def _build_cookie_kwargs() -> dict:
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    return {
        "max_age": max_age,
        "path": "/",
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
    }


def _build_transient_cookie_kwargs(max_age: int = 600) -> dict:
    return {
        "max_age": max_age,
        "path": "/",
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
        "httponly": True,
    }


def _set_auth_cookies(response: Response, access_token: str, csrf_token: str):
    cookie_kwargs = _build_cookie_kwargs()
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=access_token,
        httponly=True,
        **cookie_kwargs,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        **cookie_kwargs,
    )


def _clear_auth_cookies(response: Response):
    cookie_kwargs = {
        "path": "/",
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
    }
    response.delete_cookie(settings.AUTH_COOKIE_NAME, **cookie_kwargs)
    response.delete_cookie(settings.CSRF_COOKIE_NAME, **cookie_kwargs)


def _set_sso_flow_cookies(response: Response, *, state: str, code_verifier: str, next_path: str):
    cookie_kwargs = _build_transient_cookie_kwargs()
    response.set_cookie(_SSO_STATE_COOKIE_NAME, state, **cookie_kwargs)
    response.set_cookie(_SSO_CODE_VERIFIER_COOKIE_NAME, code_verifier, **cookie_kwargs)
    response.set_cookie(_SSO_NEXT_COOKIE_NAME, next_path, **cookie_kwargs)


def _clear_sso_flow_cookies(response: Response):
    cookie_kwargs = {
        "path": "/",
        "domain": settings.SESSION_COOKIE_DOMAIN,
        "secure": _cookie_secure(),
        "samesite": _cookie_samesite(),
    }
    response.delete_cookie(_SSO_STATE_COOKIE_NAME, **cookie_kwargs)
    response.delete_cookie(_SSO_CODE_VERIFIER_COOKIE_NAME, **cookie_kwargs)
    response.delete_cookie(_SSO_NEXT_COOKIE_NAME, **cookie_kwargs)


def _sso_enabled() -> bool:
    return settings.AUTH_MODE == "authentik"


def _local_login_enabled() -> bool:
    if settings.AUTH_LOCAL_LOGIN_ENABLED is not None:
        return settings.AUTH_LOCAL_LOGIN_ENABLED
    return not _sso_enabled()


def _public_app_base_url(request: Request | None = None) -> str:
    if settings.APP_BASE_URL:
        return str(settings.APP_BASE_URL).rstrip("/")
    if request is not None:
        return str(request.base_url).rstrip("/")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="APP_BASE_URL must be configured to use SSO.",
    )


def _build_sso_redirect_uri(request: Request | None = None) -> str:
    return f"{_public_app_base_url(request)}{settings.AUTHENTIK_REDIRECT_PATH}"


def _build_post_logout_redirect_uri(request: Request | None = None) -> str:
    return f"{_public_app_base_url(request)}{settings.AUTHENTIK_POST_LOGOUT_PATH}"


def _sanitize_next_path(next_path: Optional[str], *, default: str = "/dashboard") -> str:
    if not next_path:
        return default
    candidate = next_path.strip()
    parsed = urlparse(candidate)
    if parsed.scheme in {"https", "http"} and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}".lower()
        allowed_origins = {
            item.strip().rstrip("/").lower()
            for item in settings.AUTHENTIK_ALLOWED_RETURN_ORIGINS.split(",")
            if item.strip()
        }
        return candidate if parsed.scheme == "https" and origin in allowed_origins else default
    if not candidate.startswith("/") or candidate.startswith("//"):
        return default
    if candidate.startswith("/api/"):
        return default
    if candidate == "/admin" or candidate.startswith("/admin/"):
        admin_suffix = candidate[len("/admin") :]
        return f"{settings.ADMIN_PORTAL_PATH}{admin_suffix}"
    return candidate


def _default_redirect_for_role(role: UserRole) -> str:
    if role == UserRole.ADMIN:
        return settings.ADMIN_PORTAL_PATH
    if role == UserRole.TEACHER_PREMIUM:
        return "/classroom"
    return "/dashboard"


def _default_redirect_for_user(user: User, request: Request | None = None) -> str:
    if user.role == UserRole.ADMIN and request is not None and not is_vpn_or_local_request(request):
        return "/dashboard"
    return _default_redirect_for_role(user.role)


def _extract_token_from_request(
    request: Request,
) -> tuple[Optional[str], Optional[Literal["header", "cookie"]]]:
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token:
            return token, "header"

    cookie_token = request.cookies.get(settings.AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token, "cookie"
    return None, None


def _enforce_csrf_if_needed(request: Request, token_source: Optional[Literal["header", "cookie"]]):
    safe_methods = {"GET", "HEAD", "OPTIONS"}
    if token_source != "cookie" or request.method.upper() in safe_methods:
        return

    csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed.")


def _resolve_user_from_token(
    token: str,
    session: Session,
    credentials_exception: HTTPException,
) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def _parse_match_list(raw: str) -> set[str]:
    return {item.strip() for item in raw.split(",") if item.strip()}


def _normalize_claim_values(raw_value: object) -> list[str]:
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        return [str(item).strip() for item in raw_value if str(item).strip()]
    if isinstance(raw_value, tuple):
        return [str(item).strip() for item in raw_value if str(item).strip()]
    if isinstance(raw_value, str):
        stripped = raw_value.strip()
        if not stripped:
            return []
        if "," in stripped:
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return [stripped]
    return [str(raw_value).strip()]


def _matches_role_mapping(claim_values: list[str], matches: str) -> bool:
    allowed = _parse_match_list(matches)
    return bool(allowed and allowed.intersection(claim_values))


def _resolve_sso_role(claims: dict, existing_role: UserRole | None) -> UserRole:
    claim_values = _normalize_claim_values(claims.get(settings.AUTHENTIK_ROLE_CLAIM))
    if _matches_role_mapping(claim_values, settings.AUTHENTIK_ADMIN_MATCHES):
        return UserRole.ADMIN
    if _matches_role_mapping(claim_values, settings.AUTHENTIK_TEACHER_PREMIUM_MATCHES):
        return UserRole.TEACHER_PREMIUM
    if existing_role is not None:
        return existing_role
    return UserRole(settings.AUTHENTIK_DEFAULT_ROLE)


def _normalize_username(value: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9._-]+", "-", value or "").strip(".-_").lower()
    if not base:
        base = f"user-{secrets.token_hex(4)}"
    return base[:64]


def _build_unique_username(session: Session, preferred: str, current_user_id: int | None = None) -> str:
    base = _normalize_username(preferred)
    candidate = base
    suffix = 1
    while True:
        existing = session.exec(select(User).where(User.username == candidate)).first()
        if not existing or existing.id == current_user_id:
            return candidate
        suffix += 1
        candidate = f"{base[:58]}-{suffix}"


async def fetch_oidc_metadata() -> dict:
    if not _sso_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO is not enabled.")

    now = time.monotonic()
    cached_at = _oidc_metadata_cache.get("cached_at")
    cached_payload = _oidc_metadata_cache.get("payload")
    if isinstance(cached_at, (int, float)) and isinstance(cached_payload, dict):
        if now - float(cached_at) < _OIDC_CACHE_TTL_SECONDS:
            return cached_payload

    issuer = str(settings.AUTHENTIK_ISSUER_URL).rstrip("/")
    discovery_url = f"{issuer}/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(discovery_url)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not load Authentik OIDC metadata.",
        )

    payload = response.json()
    required_fields = {"authorization_endpoint", "token_endpoint", "userinfo_endpoint"}
    if not required_fields.issubset(payload):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OIDC metadata is missing required endpoints.",
        )

    _oidc_metadata_cache["cached_at"] = now
    _oidc_metadata_cache["payload"] = payload
    return payload


async def exchange_oidc_authorization_code(code: str, code_verifier: str, redirect_uri: str) -> dict:
    metadata = await fetch_oidc_metadata()
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.AUTHENTIK_CLIENT_ID,
        "client_secret": settings.AUTHENTIK_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            metadata["token_endpoint"],
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentik rejected the authorization code.",
        )
    token_payload = response.json()
    if not token_payload.get("access_token"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OIDC token response did not include an access token.",
        )
    return token_payload


async def fetch_oidc_userinfo(access_token: str) -> dict:
    metadata = await fetch_oidc_metadata()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            metadata["userinfo_endpoint"],
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not load user profile from Authentik.",
        )
    payload = response.json()
    if not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OIDC user profile did not include a subject identifier.",
        )
    return payload


async def build_sso_logout_url(request: Request | None = None) -> Optional[str]:
    if not _sso_enabled():
        return None
    try:
        metadata = await fetch_oidc_metadata()
    except HTTPException:
        return None
    end_session_endpoint = metadata.get("end_session_endpoint")
    if not end_session_endpoint:
        return None
    query = urlencode({"post_logout_redirect_uri": _build_post_logout_redirect_uri(request)})
    return f"{end_session_endpoint}?{query}"


def _upsert_sso_user(session: Session, claims: dict) -> User:
    subject = str(claims["sub"]).strip()
    email_value = claims.get(settings.AUTHENTIK_EMAIL_CLAIM)
    email = str(email_value).strip().lower() if isinstance(email_value, str) and email_value.strip() else None
    username_claim = claims.get(settings.AUTHENTIK_USERNAME_CLAIM) or claims.get("preferred_username")
    fallback_username = email.split("@", 1)[0] if email else subject
    preferred_username = str(username_claim).strip() if isinstance(username_claim, str) and username_claim.strip() else fallback_username

    user = session.exec(select(User).where(User.oidc_subject == subject)).first()
    if not user and email:
        user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        normalized_username = _normalize_username(preferred_username)
        user = session.exec(select(User).where(User.username == normalized_username)).first()

    resolved_role = _resolve_sso_role(claims, user.role if user else None)
    desired_username = _build_unique_username(session, preferred_username, user.id if user else None)

    if user:
        user.username = desired_username
        user.email = email
        user.role = resolved_role
        user.auth_provider = "authentik"
        user.oidc_subject = subject
        user.is_active = True
    else:
        user = User(
            username=desired_username,
            email=email,
            role=resolved_role,
            auth_provider="authentik",
            oidc_subject=subject,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            is_active=True,
        )
        session.add(user)

    session.commit()
    session.refresh(user)
    return user


async def get_current_user(
    request: Request,
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token, token_source = _extract_token_from_request(request)
    if not token:
        raise credentials_exception

    _enforce_csrf_if_needed(request, token_source)
    return _resolve_user_from_token(token, session, credentials_exception)


async def get_current_user_optional(
    request: Request,
    session: Session = Depends(get_session),
) -> Optional[User]:
    token, token_source = _extract_token_from_request(request)
    if not token:
        return None

    _enforce_csrf_if_needed(request, token_source)
    try:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        return _resolve_user_from_token(token, session, credentials_exception)
    except HTTPException:
        return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def require_admin_from_vpn(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    if not is_vpn_or_local_request(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access requires VPN/local network.",
        )
    return current_user


async def require_admin_or_vpn(
    request: Request,
    current_user: User | None = Depends(get_current_user_optional),
) -> User | None:
    if current_user and current_user.role == UserRole.ADMIN:
        return current_user
    if is_vpn_or_local_request(request):
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin or VPN/local access required",
    )


@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config():
    sso_enabled = _sso_enabled()
    return AuthConfigResponse(
        auth_mode=settings.AUTH_MODE,
        local_login_enabled=_local_login_enabled(),
        sso_enabled=sso_enabled,
        sso_provider="authentik" if sso_enabled else None,
        sso_login_path=f"{settings.API_V1_STR}/auth/sso/login" if sso_enabled else None,
    )


@router.get("/admin-surface")
async def get_admin_surface_access(_admin: User = Depends(require_admin_from_vpn)):
    return {"allowed": True}


@router.get("/default-destination", response_model=DefaultDestinationResponse)
async def get_default_destination(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    return DefaultDestinationResponse(path=_default_redirect_for_user(current_user, request))


@router.post("/login", response_model=LoginResponse)
@limiter.limit("20/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    """Authenticate user and establish cookie-based session."""
    if not _local_login_enabled():
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="Local login is disabled. Use EDUmind SSO.",
        )

    user = authenticate_user(session, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    log = ActivityLog(
        user_id=user.id,
        action="login",
        details=f"User {user.username} logged in",
        ip_address=get_client_ip(request),
    )
    session.add(log)
    session.commit()

    access_token = create_access_token(data={"sub": user.username})
    csrf_token = secrets.token_urlsafe(32)
    _set_auth_cookies(response, access_token, csrf_token)

    return {
        "token_type": "bearer",
        "session_auth": "cookie",
        "csrf_token": csrf_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
        },
    }


@router.get("/sso/login")
@limiter.limit("20/minute")
async def sso_login(
    request: Request,
    next_path: Optional[str] = Query(default=None, alias="next"),
):
    if not _sso_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO is not enabled.")

    metadata = await fetch_oidc_metadata()
    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("utf-8")).digest()
    ).rstrip(b"=").decode("ascii")
    safe_next_path = _sanitize_next_path(next_path, default="/dashboard")
    redirect_uri = _build_sso_redirect_uri(request)
    authorize_query = urlencode(
        {
            "client_id": settings.AUTHENTIK_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": settings.AUTHENTIK_SCOPES,
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    )
    response = RedirectResponse(
        url=f"{metadata['authorization_endpoint']}?{authorize_query}",
        status_code=status.HTTP_302_FOUND,
    )
    _set_sso_flow_cookies(
        response,
        state=state,
        code_verifier=code_verifier,
        next_path=safe_next_path,
    )
    return response


@router.get("/sso/callback")
async def sso_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    session: Session = Depends(get_session),
):
    if not _sso_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO is not enabled.")
    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentik denied the login request: {error}",
        )

    expected_state = request.cookies.get(_SSO_STATE_COOKIE_NAME)
    code_verifier = request.cookies.get(_SSO_CODE_VERIFIER_COOKIE_NAME)
    next_path = request.cookies.get(_SSO_NEXT_COOKIE_NAME)
    if not code or not state or not expected_state or not code_verifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid SSO callback state.",
        )
    if not secrets.compare_digest(state, expected_state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SSO state validation failed.",
        )

    redirect_uri = _build_sso_redirect_uri(request)
    token_payload = await exchange_oidc_authorization_code(code, code_verifier, redirect_uri)
    claims = await fetch_oidc_userinfo(token_payload["access_token"])
    user = _upsert_sso_user(session, claims)

    session.add(
        ActivityLog(
            user_id=user.id,
            action="login_sso",
            details=f"User {user.username} logged in via Authentik",
            ip_address=get_client_ip(request),
        )
    )
    session.commit()

    access_token = create_access_token(data={"sub": user.username})
    csrf_token = secrets.token_urlsafe(32)
    redirect_target = _sanitize_next_path(next_path, default=_default_redirect_for_role(user.role))
    response = RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    _set_auth_cookies(response, access_token, csrf_token)
    _clear_sso_flow_cookies(response)
    return response


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role.value,
        is_active=current_user.is_active,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(request: Request, response: Response):
    _clear_auth_cookies(response)
    _clear_sso_flow_cookies(response)
    logout_url = await build_sso_logout_url(request)
    return LogoutResponse(message="Logged out", logout_url=logout_url)
