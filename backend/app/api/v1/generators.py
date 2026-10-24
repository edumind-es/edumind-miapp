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

import hashlib
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from sqlmodel import Session

from app import schemas
from app.api.v1.auth import get_current_user_optional, require_admin_or_vpn
from app.core import config
from app.core.prompt_registry import (
    PromptBundle,
    PromptValidationError,
    get_generator_prompt,
    list_prompt_contracts,
)
from app.core.queue_manager import queue_manager
from app.core.security import get_client_ip, is_vpn_or_local_request
from app.db import get_session
from app.models import ActivityLog, TrainingItem, TrainingItemSource, User, UserRole
from app.schemas import PlanningRequest, ProjectRequest, SituationRequest
from app.services.admission_control_service import admission_control
from app.services.ai_service import AIService
from app.services.background_task_queue_service import enqueue_provider_alert_push_job
from app.services.curriculum_matrix_service import CurriculumMatrixService
from app.services.metrics_service import metrics
from app.services.provider_observability_service import (
    apply_provider_guard_overrides,
    build_provider_alerts,
    build_provider_reliability,
    load_observability_alert_policy,
    load_provider_guard_overrides,
)

router = APIRouter()
settings = config.settings
logger = logging.getLogger(__name__)

INTERNAL_OUTPUT_LINE_PATTERNS = (
    re.compile(r"^\[sistema\]:", re.IGNORECASE),
    re.compile(r"^\[system instructions\]", re.IGNORECASE),
    re.compile(r"^instrucciones de formato:?$", re.IGNORECASE),
    re.compile(r"^documentación de referencia", re.IGNORECASE),
    re.compile(r"^rol específico:?$", re.IGNORECASE),
    re.compile(r"^recursos y herramientas edumind disponibles:?$", re.IGNORECASE),
    re.compile(r"^recursos externos recomendados:?$", re.IGNORECASE),
    re.compile(r"^contrato de calidad de respuesta \(obligatorio\):?$", re.IGNORECASE),
)


def _generator_limit_key(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(key_func=_generator_limit_key)

BYOK_PROVIDERS = {"chatgpt", "claude", "gemini"}
MANAGED_PROVIDERS = {"edumind"}
RESTRICTED_PROVIDERS = {"ollama", "mistral"}
ALLOWED_PROVIDERS = BYOK_PROVIDERS | MANAGED_PROVIDERS | RESTRICTED_PROVIDERS


class PromptRenderResponse(BaseModel):
    tool: str
    prompt_id: str
    prompt_version: str
    risk_level: str
    response_format: str
    output_schema: dict[str, Any] | None
    sanitized_payload: dict[str, Any]
    local_prompt_mode: str


class DatasetContributionRequest(BaseModel):
    instruction: Optional[str] = None
    output: str
    tool: Optional[str] = None
    provider: Optional[str] = None


def _has_network_resolution_issue(error_text: str) -> bool:
    normalized = (error_text or "").lower()
    markers = (
        "temporary failure in name resolution",
        "name or service not known",
        "nodename nor servname provided",
        "failed to resolve",
        "getaddrinfo failed",
        "connecterror",
        "connection refused",
        "timed out",
        "timeout",
    )
    return any(marker in normalized for marker in markers)


def _has_timeout_issue(error_text: str) -> bool:
    normalized = (error_text or "").lower()
    markers = (
        "timed out",
        "timeout",
        "read timeout",
        "connect timeout",
        "request timeout",
    )
    return any(marker in normalized for marker in markers)


def _classify_failure_outcome(error_text: str) -> str:
    if _has_timeout_issue(error_text):
        return "timeout"
    if _has_network_resolution_issue(error_text):
        return "dns_error"
    return "provider_error"


def _build_provider_error_message(provider: str, error: Exception) -> str:
    normalized_error = str(error or "").lower()
    provider_label = provider.upper()

    if _has_network_resolution_issue(normalized_error):
        if provider == "edumind":
            return (
                "Error: EDUmind Cloud Lite no está disponible por conectividad DNS/red del servidor. "
                "Usa IA local mientras se restablece la salida a Internet."
            )
        return (
            f"Error: El servidor no tiene conectividad DNS/red hacia {provider_label}. "
            "Revisa DNS/egress o usa IA local temporalmente."
        )

    if provider == "gemini":
        if any(marker in normalized_error for marker in ("api key", "unauthorized", "unauthenticated", "permission")):
            return "Error: API key de Gemini inválida o sin permisos para este modelo."
        if any(marker in normalized_error for marker in ("quota", "resource exhausted", "rate limit", "429")):
            return "Error: Cuota de Gemini agotada o límite de peticiones alcanzado."

    return "Error: No se pudo completar la generación con el proveedor solicitado."


def _build_public_render_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        key: value
        for key, value in (payload or {}).items()
        if key not in {"provider", "api_key", "apiKey", "response_format"}
    }


def clean_text_chunk(text: str) -> str:
    text = _strip_provider_artifacts(text)
    # Remove common markdown artifacts
    text = re.sub(r"\*\*", "", text)
    text = re.sub(r"__", "", text)
    text = re.sub(r"#{1,6}\s?", "", text)
    return text


def _strip_provider_artifacts(text: str) -> str:
    cleaned = (text or "").replace("\r\n", "\n")
    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<\|[^|]+?\|>", "", cleaned)
    return cleaned


def _sanitize_final_output(text: str) -> str:
    cleaned = _strip_provider_artifacts(text)
    filtered_lines = [
        line for line in cleaned.split("\n") if not any(pattern.match(line.strip()) for pattern in INTERNAL_OUTPUT_LINE_PATTERNS)
    ]
    return "\n".join(filtered_lines).strip()


def _extract_json_slice(text: str) -> str | None:
    cleaned = _sanitize_final_output(text)
    if not cleaned:
        return None

    direct_candidates = [cleaned]
    fenced_match = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", cleaned, flags=re.IGNORECASE)
    if fenced_match:
        direct_candidates.insert(0, fenced_match.group(1).strip())

    for candidate in direct_candidates:
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            continue

    for start_index, char in enumerate(cleaned):
        if char not in "[{":
            continue
        stack: list[str] = [char]
        in_string = False
        escape_next = False
        for end_index in range(start_index + 1, len(cleaned)):
            current = cleaned[end_index]
            if escape_next:
                escape_next = False
                continue
            if current == "\\":
                escape_next = True
                continue
            if current == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if current in "[{":
                stack.append(current)
                continue
            if current in "]}":
                if not stack:
                    break
                opener = stack[-1]
                if (opener == "{" and current != "}") or (opener == "[" and current != "]"):
                    break
                stack.pop()
                if not stack:
                    candidate = cleaned[start_index : end_index + 1]
                    try:
                        json.loads(candidate)
                        return candidate
                    except json.JSONDecodeError:
                        break
    return None


def _validate_json_value(value: Any, schema: dict[str, Any], path: str = "$") -> list[str]:
    schema_type = schema.get("type")
    errors: list[str] = []

    if schema_type == "object":
        if not isinstance(value, dict):
            return [f"{path} debe ser un objeto."]
        required = schema.get("required", [])
        properties = schema.get("properties", {})
        additional_allowed = schema.get("additionalProperties", True)
        for key in required:
            if key not in value:
                errors.append(f"{path}.{key} es obligatorio.")
        if additional_allowed is False:
            for key in value:
                if key not in properties:
                    errors.append(f"{path}.{key} no está permitido.")
        for key, child_schema in properties.items():
            if key in value:
                errors.extend(_validate_json_value(value[key], child_schema, f"{path}.{key}"))
        return errors

    if schema_type == "array":
        if not isinstance(value, list):
            return [f"{path} debe ser una lista."]
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                errors.extend(_validate_json_value(item, item_schema, f"{path}[{index}]"))
        return errors

    if schema_type == "string":
        if not isinstance(value, str) or not value.strip():
            return [f"{path} debe ser un texto no vacío."]
        return []

    if schema_type == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return [f"{path} debe ser numérico."]
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and value < minimum:
            errors.append(f"{path} debe ser >= {minimum}.")
        if maximum is not None and value > maximum:
            errors.append(f"{path} debe ser <= {maximum}.")
        return errors

    if schema_type == "boolean":
        if not isinstance(value, bool):
            return [f"{path} debe ser booleano."]
        return []

    return []


def _normalize_structured_output(raw_text: str, prompt_bundle: PromptBundle) -> str:
    json_candidate = _extract_json_slice(raw_text)
    if not json_candidate:
        raise ValueError("No se pudo extraer un JSON válido de la respuesta.")

    parsed = json.loads(json_candidate)
    schema = prompt_bundle.output_schema or {}
    errors = _validate_json_value(parsed, schema)
    if errors:
        raise ValueError("; ".join(errors[:5]))

    return json.dumps(parsed, ensure_ascii=False, indent=2)


def _is_admin(current_user: Optional[User]) -> bool:
    return bool(current_user and current_user.role == UserRole.ADMIN)


def _normalize_provider(provider: str) -> str:
    normalized = (provider or "").lower().strip()
    if normalized not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider '{provider}' is not supported.")
    return normalized


def _resolve_api_key(provider: str, api_key: Optional[str], is_admin: bool) -> Optional[str]:
    """Clave para proveedores externos: solo la que aporta el usuario.

    No existe fallback a claves del sistema, tampoco para admin: EDUmind no
    envía textos de usuarios a terceros por cuenta propia.
    """
    del provider, is_admin
    if api_key and api_key.strip():
        return api_key.strip()
    return None


async def _resolve_request_api_key(request: Request, parsed_api_key: Optional[str]) -> Optional[str]:
    if parsed_api_key and parsed_api_key.strip():
        return parsed_api_key.strip()

    # Backward compatibility: legacy frontend bundles may still send `apiKey`.
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = None

    if isinstance(raw_payload, dict):
        legacy_api_key = raw_payload.get("apiKey")
        if isinstance(legacy_api_key, str) and legacy_api_key.strip():
            return legacy_api_key.strip()
    return None


async def _authorize_generation_request(
    request: Request,
    provider: str,
    current_user: Optional[User],
    input_chars: int,
):
    is_admin = _is_admin(current_user)

    if provider in MANAGED_PROVIDERS:
        decision = await admission_control.evaluate_managed_provider_access(
            request=request,
            current_user=current_user,
            provider=provider,
            input_chars=input_chars,
        )
        if not decision.allowed:
            headers = {"X-EDUMIND-FALLBACK": "webgpu,byok"}
            if decision.retry_after > 0:
                headers["Retry-After"] = str(decision.retry_after)
            if decision.challenge_required:
                headers["X-EDUMIND-CHALLENGE"] = "captcha"
                headers["X-EDUMIND-CHALLENGE-LEVEL"] = "soft"
            raise HTTPException(
                status_code=decision.status_code,
                detail=decision.message,
                headers=headers,
            )

    if provider in RESTRICTED_PROVIDERS and not (is_admin or is_vpn_or_local_request(request)):
        raise HTTPException(
            status_code=403,
            detail="This model is restricted to administrators or VPN/local network.",
        )


async def _reserve_generation_slot(request: Request, current_user: Optional[User]):
    is_admin = _is_admin(current_user)
    identity = f"user_{current_user.id}" if current_user else f"ip_{get_client_ip(request)}"
    queue_status = await queue_manager.reserve_slot(identity, is_admin)
    if not queue_status.is_active:
        raise HTTPException(
            status_code=429,
            detail=queue_status.message,
            headers={"Retry-After": str(queue_status.estimated_wait_seconds)},
        )


def _persist_generation_trace(
    db: Session,
    current_user: Optional[User],
    request_ip: str,
    tool_name: str,
    provider: str,
    prompt_bundle: PromptBundle,
    response_chars: int,
    failed: bool,
    outcome: str,
):
    details = {
        "tool": tool_name,
        "provider": provider,
        "prompt_id": prompt_bundle.prompt_id,
        "prompt_version": prompt_bundle.prompt_version,
        "risk_level": prompt_bundle.risk_level,
        "response_format": prompt_bundle.response_format,
        "output_schema_enabled": bool(prompt_bundle.output_schema),
        "prompt_sha256": hashlib.sha256(prompt_bundle.prompt_text.encode("utf-8")).hexdigest(),
        "response_chars": response_chars,
        "failed": failed,
        "outcome": outcome,
    }

    try:
        db.add(
            ActivityLog(
                user_id=current_user.id if current_user else None,
                action=f"generate_{tool_name}",
                resource_type="prompt_contract",
                details=json.dumps(details, ensure_ascii=True),
                ip_address=request_ip,
            )
        )
        db.commit()
    except Exception:
        db.rollback()


async def _stream_generator(
    provider: str,
    api_key: Optional[str],
    prompt_bundle: PromptBundle,
    tool_name: str,
    request_ip: str,
    db: Session,
    current_user: Optional[User],
):
    messages = [{"role": "user", "content": prompt_bundle.prompt_text}]

    if provider in BYOK_PROVIDERS and not api_key:
        yield f"Error: You must provide your own API key for provider '{provider}'."
        return

    full_response = ""
    failed = False
    outcome = "success"
    has_substantive_output = False
    started_at = time.monotonic()
    try:
        if prompt_bundle.response_format == "json":
            raw_response = ""
            async for chunk in AIService.stream_chat(
                provider,
                messages,
                api_key,
                generator_type=tool_name,
            ):
                cleaned_chunk = _strip_provider_artifacts(chunk)
                if not cleaned_chunk:
                    continue
                if cleaned_chunk.strip():
                    has_substantive_output = True
                raw_response += cleaned_chunk

            stripped_response = raw_response.lstrip()
            if not has_substantive_output:
                failed = True
                outcome = "empty"
                if provider == "edumind":
                    yield (
                        "Error: EDUmind Cloud Lite no devolvió contenido útil. "
                        "Prueba IA local y revisa el estado de conectividad del servidor."
                    )
                elif provider == "gemini":
                    yield (
                        "Error: Gemini no devolvió contenido útil. "
                        "Verifica API key, cuota y restricciones de seguridad del proveedor."
                    )
                else:
                    yield (
                        "Error: El proveedor no devolvió contenido útil. "
                        "Revisa tu API key, cuota o filtros de seguridad y vuelve a intentarlo."
                    )
            elif stripped_response.lower().startswith("error:"):
                failed = True
                outcome = _classify_failure_outcome(stripped_response)
                yield stripped_response
            else:
                try:
                    full_response = _normalize_structured_output(raw_response, prompt_bundle)
                    yield full_response
                except Exception:
                    failed = True
                    outcome = "invalid_output"
                    logger.exception("Structured output validation failed for provider=%s tool=%s", provider, tool_name)
                    yield (
                        "Error: El proveedor devolvió una estructura no publicable. "
                        "Revisa los datos de entrada o prueba otro motor."
                    )
        else:
            async for chunk in AIService.stream_chat(
                provider,
                messages,
                api_key,
                generator_type=tool_name,
            ):
                cleaned_chunk = clean_text_chunk(chunk)
                if not cleaned_chunk:
                    continue
                if cleaned_chunk.strip():
                    has_substantive_output = True
                yield cleaned_chunk
                full_response += cleaned_chunk

            stripped_response = full_response.lstrip()
            if not has_substantive_output:
                failed = True
                outcome = "empty"
                if provider == "edumind":
                    yield (
                        "Error: EDUmind Cloud Lite no devolvió contenido útil. "
                        "Prueba IA local y revisa el estado de conectividad del servidor."
                    )
                elif provider == "gemini":
                    yield (
                        "Error: Gemini no devolvió contenido útil. "
                        "Verifica API key, cuota y restricciones de seguridad del proveedor."
                    )
                else:
                    yield (
                        "Error: El proveedor no devolvió contenido útil. "
                        "Revisa tu API key, cuota o filtros de seguridad y vuelve a intentarlo."
                    )
            elif stripped_response.lower().startswith("error:"):
                failed = True
                outcome = _classify_failure_outcome(stripped_response)

    except Exception as exc:
        failed = True
        outcome = _classify_failure_outcome(str(exc))
        logger.exception("Generation stream failed for provider=%s tool=%s", provider, tool_name)
        yield _build_provider_error_message(provider, exc)
    finally:
        duration_ms = (time.monotonic() - started_at) * 1000
        metrics.record_generation(
            tool_name=tool_name,
            provider=provider,
            outcome=outcome,
            duration_ms=duration_ms,
        )
        _persist_generation_trace(
            db=db,
            current_user=current_user,
            request_ip=request_ip,
            tool_name=tool_name,
            provider=provider,
            prompt_bundle=prompt_bundle,
            response_chars=len(full_response),
            failed=failed,
            outcome=outcome,
        )

        # Privacy-first policy: no automatic dataset persistence from generation.
        # Dataset intake only happens through explicit voluntary opt-in (`/contribute`).
        try:
            policy = load_observability_alert_policy(db)
            snapshot = metrics.get_metrics()
            alerts = build_provider_alerts(snapshot, policy)
            enqueue_provider_alert_push_job(db, alerts)
        except Exception:
            logger.exception("Provider alert enqueue failed")


async def _generate_with_bundle(
    request: Request,
    tool_name: str,
    prompt_bundle: PromptBundle,
    provider: str,
    api_key: Optional[str],
    db: Session,
    current_user: Optional[User],
):
    provider = _normalize_provider(provider)

    if provider in MANAGED_PROVIDERS:
        policy = load_observability_alert_policy(db)
        guard_overrides = load_provider_guard_overrides(db)
        reliability = apply_provider_guard_overrides(
            build_provider_reliability(metrics.get_metrics(), policy),
            guard_overrides,
        ).get(provider)
        if reliability and reliability.get("available") is False:
            reason = (reliability.get("reason") or "degradación operativa").strip()
            raise HTTPException(
                status_code=503,
                detail=(
                    f"{provider.upper()} temporalmente deshabilitado: {reason}. "
                    "Usa WebGPU local o proveedor BYOK."
                ),
                headers={
                    "X-EDUMIND-FALLBACK": "webgpu,byok",
                    "Retry-After": "45",
                },
            )

    await _authorize_generation_request(
        request,
        provider,
        current_user,
        input_chars=len(prompt_bundle.prompt_text),
    )

    resolved_api_key = _resolve_api_key(provider, api_key, _is_admin(current_user))
    if provider in BYOK_PROVIDERS and not resolved_api_key:
        raise HTTPException(
            status_code=402,
            detail=f"Sustainability Mode: You must provide your own {provider} API Key.",
        )

    await _reserve_generation_slot(request, current_user)

    return StreamingResponse(
        _stream_generator(
            provider=provider,
            api_key=resolved_api_key,
            prompt_bundle=prompt_bundle,
            tool_name=tool_name,
            request_ip=get_client_ip(request),
            db=db,
            current_user=current_user,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


async def _generate_tool(
    request: Request,
    tool_name: str,
    payload_data: dict[str, Any],
    provider: str,
    api_key: Optional[str],
    db: Session,
    current_user: Optional[User],
):
    api_key = await _resolve_request_api_key(request, api_key)

    # Si el payload referencia una matriz curricular oficial, se inyectan sus elementos
    payload_data = CurriculumMatrixService.enrich_generator_payload(payload_data)

    try:
        prompt_bundle = get_generator_prompt(tool_name, payload_data)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PromptValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return await _generate_with_bundle(
        request=request,
        tool_name=tool_name,
        prompt_bundle=prompt_bundle,
        provider=provider,
        api_key=api_key,
        db=db,
        current_user=current_user,
    )


@router.get("/prompt-contracts")
async def get_prompt_contracts(_guard: User | None = Depends(require_admin_or_vpn)):
    return {"contracts": list_prompt_contracts()}


@router.post("/render/{tool}", response_model=PromptRenderResponse)
@limiter.limit("30/minute")
async def render_prompt(
    request: Request,
    tool: str,
    payload: dict[str, Any] = Body(default_factory=dict),
):
    try:
        bundle = get_generator_prompt(tool, CurriculumMatrixService.enrich_generator_payload(payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PromptValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PromptRenderResponse(
        tool=bundle.tool,
        prompt_id=bundle.prompt_id,
        prompt_version=bundle.prompt_version,
        risk_level=bundle.risk_level,
        response_format=bundle.response_format,
        output_schema=bundle.output_schema,
        sanitized_payload=_build_public_render_payload(bundle.sanitized_payload),
        local_prompt_mode="safe_client_template_v1",
    )


@router.post("/contribute")
@limiter.limit("6/minute")
async def contribute_generation_output(
    request: Request,
    payload: DatasetContributionRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Save a generation to dataset only when user explicitly opts in from UI.
    """
    clean_output = (payload.output or "").strip()
    if len(clean_output) < 80:
        raise HTTPException(status_code=422, detail="El contenido a contribuir es demasiado corto.")
    if len(clean_output) > 64000:
        raise HTTPException(status_code=413, detail="El contenido a contribuir excede el límite permitido.")

    clean_instruction = (payload.instruction or "").strip()
    clean_tool = (payload.tool or "").strip().lower() or "generador"
    clean_provider = (payload.provider or "").strip().lower() or "unknown"

    if not clean_instruction:
        clean_instruction = f"Contribución voluntaria ({clean_tool})"

    item = TrainingItem(
        instruction=clean_instruction[:4000],
        output=clean_output,
        source=TrainingItemSource.CHAT,
        quality_score=0,
        is_verified=False,
        creator_id=current_user.id if current_user else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    details = {
        "item_id": item.id,
        "tool": clean_tool,
        "provider": clean_provider,
        "output_chars": len(clean_output),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "privacy_mode": "opt_in_only",
    }
    try:
        db.add(
            ActivityLog(
                user_id=current_user.id if current_user else None,
                action="dataset_contribution_opt_in",
                resource_type="training_item",
                resource_id=item.id,
                details=json.dumps(details, ensure_ascii=True),
                ip_address=get_client_ip(request),
            )
        )
        db.commit()
    except Exception:
        db.rollback()

    return {
        "ok": True,
        "id": item.id,
        "status": "pending_review",
        "message": "Contribución recibida. Pendiente de revisión en panel admin.",
    }


@router.post("/planning")
@limiter.limit("6/minute")
async def generate_planning(
    request: Request,
    payload: PlanningRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "planning", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/situation")
@limiter.limit("6/minute")
async def generate_situation(
    request: Request,
    payload: SituationRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "situation", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/project")
@limiter.limit("6/minute")
async def generate_project(
    request: Request,
    payload: ProjectRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "project", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


# Docentes Extra
@router.post("/stem")
@limiter.limit("6/minute")
async def generate_stem(
    request: Request,
    payload: schemas.SteamRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "stem", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/diversity")
@limiter.limit("6/minute")
async def generate_diversity(
    request: Request,
    payload: schemas.DiversityRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "diversity", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/session")
@limiter.limit("6/minute")
async def generate_session(
    request: Request,
    payload: schemas.SessionRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "session", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


# Opositores
@router.post("/topic")
@limiter.limit("6/minute")
async def generate_topic(
    request: Request,
    payload: schemas.TopicRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "topic", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/case")
@limiter.limit("6/minute")
async def generate_case(
    request: Request,
    payload: schemas.CaseRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "case", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/defense")
@limiter.limit("6/minute")
async def generate_defense(
    request: Request,
    payload: schemas.DefenseRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "defense", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/idea")
@limiter.limit("6/minute")
async def generate_idea(
    request: Request,
    payload: schemas.IdeaRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "idea", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


# Centros
@router.post("/minutes")
@limiter.limit("6/minute")
async def generate_minutes(
    request: Request,
    payload: schemas.MinutesRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "minutes", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/institution_doc")
@limiter.limit("6/minute")
async def generate_institution_doc(
    request: Request,
    payload: schemas.InstitutionDocRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "institution_doc", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/inspection_report")
@limiter.limit("6/minute")
async def generate_inspection_report(
    request: Request,
    payload: schemas.InspectionReportRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "inspection_report", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/reinforcement_plan")
@limiter.limit("6/minute")
async def generate_reinforcement_plan(
    request: Request,
    payload: schemas.ReinforcementPlanRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "reinforcement_plan", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/rubrics")
@limiter.limit("6/minute")
async def generate_rubrics(
    request: Request,
    payload: schemas.RubricsRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "rubrics", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/worksheets")
@limiter.limit("6/minute")
async def generate_worksheets(
    request: Request,
    payload: schemas.WorksheetRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "worksheets", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/methodology")
@limiter.limit("6/minute")
async def generate_methodology(
    request: Request,
    payload: schemas.MethodologyRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "methodology", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/organization")
@limiter.limit("6/minute")
async def generate_organization(
    request: Request,
    payload: schemas.OrganizationRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "organization", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/questions")
@limiter.limit("6/minute")
async def generate_questions(
    request: Request,
    payload: schemas.QuestionRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "questions", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )


@router.post("/normativa")
@limiter.limit("6/minute")
async def generate_normativa(
    request: Request,
    payload: schemas.NormativeRequest,
    db: Session = Depends(get_session),
    current_user: User | None = Depends(get_current_user_optional),
):
    return await _generate_tool(
        request, "normativa", payload.model_dump(), payload.provider, payload.api_key, db, current_user
    )
