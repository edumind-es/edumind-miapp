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

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from app.schemas import ChatRequest
from app.services.ai_service import AIService
from app.services.admission_control_service import admission_control
from app.core.config import settings
from app.core.queue_manager import queue_manager
from app.core.security import get_client_ip, is_vpn_or_local_request
from app.models import User, UserRole
from app.api.v1.auth import get_current_user_optional

router = APIRouter()

# Rate limiter for chat (stricter limit)
def _chat_limit_key(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(key_func=_chat_limit_key)
BYOK_PROVIDERS = {"chatgpt", "deepseek", "claude", "gemini"}
MANAGED_PROVIDERS = {"edumind"}
RESTRICTED_PROVIDERS = {"ollama", "mistral"}
ALLOWED_PROVIDERS = BYOK_PROVIDERS | MANAGED_PROVIDERS | RESTRICTED_PROVIDERS

@router.post("/completions")
@limiter.limit("10/minute")
async def chat_completions(
    request: Request,
    chat_request: ChatRequest,
    current_user: User | None = Depends(get_current_user_optional)
):
    provider = chat_request.provider.lower().strip()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider '{provider}' is not supported.")

    # Determine API Key
    api_key = chat_request.api_key

    # Access Control Logic
    is_admin = current_user and current_user.role == UserRole.ADMIN
    client_ip = get_client_ip(request)

    # Managed provider is open but guarded by admission control.
    if provider in MANAGED_PROVIDERS:
        input_chars = sum(len(m.content or "") for m in chat_request.messages)
        decision = await admission_control.evaluate_managed_provider_access(
            request=request,
            current_user=current_user,
            provider=provider,
            input_chars=input_chars,
        )
        if not decision.allowed:
            headers = {}
            if decision.retry_after > 0:
                headers["Retry-After"] = str(decision.retry_after)
            if decision.challenge_required:
                headers["X-EDUMIND-CHALLENGE"] = "captcha"
                headers["X-EDUMIND-CHALLENGE-LEVEL"] = "soft"
            headers["X-EDUMIND-FALLBACK"] = "webgpu,byok"
            raise HTTPException(
                status_code=decision.status_code,
                detail=decision.message,
                headers=headers,
            )

    # Private providers consume local server resources and stay behind admin/VPN controls.
    if provider in RESTRICTED_PROVIDERS and not (is_admin or is_vpn_or_local_request(request)):
        raise HTTPException(
            status_code=403,
            detail="Access denied. This model is restricted to administrators or VPN/local network.",
        )

    # BYOK models: users must provide their own key, except admin fallback.
    if not api_key:
        if is_admin:
            # Fallback to system keys for Admin
            if provider == "deepseek":
                api_key = settings.DEEPSEEK_API_KEY
            elif provider == "claude":
                api_key = settings.CLAUDE_API_KEY
            elif provider == "gemini":
                api_key = settings.GEMINI_API_KEY

        if provider in BYOK_PROVIDERS and not api_key:
            raise HTTPException(
                status_code=402,
                detail=f"Sustainability Mode: You must provide your own {provider} API Key to use this model.",
            )

    # Queue / concurrency protection
    identity = f"user_{current_user.id}" if current_user else f"ip_{client_ip}"
    queue_status = await queue_manager.reserve_slot(identity, bool(is_admin))
    if not queue_status.is_active:
        raise HTTPException(
            status_code=429,
            detail=queue_status.message,
            headers={"Retry-After": str(queue_status.estimated_wait_seconds)},
        )

    return StreamingResponse(
        AIService.stream_chat(
            provider=provider,
            messages=[m.dict() for m in chat_request.messages],
            api_key=api_key,
            model=chat_request.model
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
