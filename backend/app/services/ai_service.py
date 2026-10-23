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

import os
import socket
import asyncio
import logging
from typing import AsyncGenerator, Optional, List, Dict
import httpx
from openai import AsyncOpenAI
from google import genai
from google.genai import types
from urllib.parse import urlparse
from app.core.config import settings
from app.core.system_prompts import (
    get_generator_prompt as get_generator_system_prompt,
    get_system_prompt,
    get_temperature,
)
from app.services.knowledge_service import KnowledgeService

logger = logging.getLogger(__name__)

# Initialize Clients
deepseek_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url="https://api.deepseek.com/v1") if settings.DEEPSEEK_API_KEY else None
# Note: For user-provided keys, we will instantiate clients per request or pass the key.


def inject_system_prompt(
    messages: List[Dict],
    provider: str,
    include_knowledge: bool = True,
    generator_type: Optional[str] = None,
) -> List[Dict]:
    """
    Inject system prompt at the beginning of messages if not already present.
    
    Args:
        messages: Original message list
        provider: AI provider name for adaptation
        include_knowledge: Whether to include knowledge base context
    
    Returns:
        Messages with system prompt injected.
    """
    has_system = any(m.get('role') == 'system' for m in messages)
    
    if has_system:
        return messages
    
    # Get knowledge context for enrichment
    knowledge_context = ""
    if include_knowledge:
        knowledge_context = KnowledgeService.get_context_for_prompt(
            include_lomloe=True,
            include_competencias=True
        )
    
    if generator_type:
        system_prompt = get_generator_system_prompt(
            generator_type=generator_type,
            provider=provider,
            include_knowledge_context=knowledge_context,
        )
    else:
        system_prompt = get_system_prompt(provider, knowledge_context)
    
    return [{"role": "system", "content": system_prompt}] + messages


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


async def _resolve_host_fast(hostname: str, timeout_seconds: float = 2.5) -> tuple[bool, str | None]:
    if not hostname:
        return False, "missing-hostname"
    try:
        await asyncio.wait_for(asyncio.to_thread(socket.getaddrinfo, hostname, None), timeout=timeout_seconds)
        return True, None
    except Exception as exc:
        return False, str(exc)


class AIService:
    @staticmethod
    async def stream_chat(
        provider: str,
        messages: list,
        api_key: str,
        model: Optional[str] = None,
        generator_type: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        
        provider = provider.lower()
        
        # Inject system prompt with knowledge context for all providers
        enriched_messages = inject_system_prompt(
            messages,
            provider,
            include_knowledge=True,
            generator_type=generator_type,
        )
        temperature = get_temperature(provider)
        
        if provider == "deepseek":
            client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")
            model = model or "deepseek-chat"
            async for chunk in await client.chat.completions.create(
                model=model,
                messages=enriched_messages,
                stream=True,
                max_tokens=4096,
                temperature=temperature
            ):
                content = chunk.choices[0].delta.content
                if content:
                    yield content

        elif provider == "mistral":
            # Mistral supports OpenAI format
            client = AsyncOpenAI(api_key=api_key, base_url="https://api.mistral.ai/v1")
            model = model or "mistral-small-latest"
            async for chunk in await client.chat.completions.create(
                model=model,
                messages=enriched_messages,
                stream=True,
                temperature=temperature
            ):
                content = chunk.choices[0].delta.content
                if content:
                    yield content

        elif provider == "chatgpt":
            # OpenAI ChatGPT - uses official API
            client = AsyncOpenAI(api_key=api_key)
            model = model or "gpt-4o"
            async for chunk in await client.chat.completions.create(
                model=model,
                messages=enriched_messages,
                stream=True,
                max_tokens=4096,
                temperature=temperature
            ):
                content = chunk.choices[0].delta.content
                if content:
                    yield content

        elif provider == "claude":
            # Anthropic Claude - requires special message format
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key)
            model = model or "claude-3-5-sonnet-20241022"
            
            # Claude SDK handles system separately from messages
            system_content = ""
            user_messages = []
            for msg in enriched_messages:
                if msg['role'] == 'system':
                    system_content += msg['content'] + "\n"
                else:
                    user_messages.append(msg)
            
            async with client.messages.stream(
                max_tokens=4096,
                system=system_content if system_content else None,
                messages=user_messages,
                model=model,
            ) as stream:
                async for text in stream.text_stream:
                    yield text

        elif provider == "gemini":
            # Using new google-genai library
            is_resolvable, dns_error = await _resolve_host_fast("generativelanguage.googleapis.com")
            if not is_resolvable:
                logger.warning("Gemini DNS preflight failed: %s", dns_error)
                yield (
                    "Error: El servidor no puede resolver el endpoint de Gemini (DNS/red). "
                    "Usa IA local mientras se restablece la conectividad."
                )
                return

            client = genai.Client(api_key=api_key)
            model_name = model or "gemini-2.0-flash"
            
            # Build full context for Gemini (concatenate system + user messages)
            full_content = ""
            for msg in enriched_messages:
                if msg['role'] == 'system':
                    full_content += f"[System Instructions]\n{msg['content']}\n\n"
                else:
                    full_content += f"{msg['content']}\n"
            
            # Use streaming
            response = client.models.generate_content_stream(
                model=model_name,
                contents=full_content
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        
        elif provider == "edumind":
            # Call to core.losmundosedufis.com (EDUmind Core)
            core_url = settings.EDUMIND_CORE_URL
            core_token = settings.EDUMIND_CORE_TOKEN
            
            if not core_url or not core_token:
                logger.error("EDUmind Core is not configured (missing URL or token).")
                yield "Error: Servicio EDUmind no disponible temporalmente."
                return

            core_hostname = urlparse(core_url).hostname
            is_resolvable, dns_error = await _resolve_host_fast(core_hostname or "")
            if not is_resolvable:
                logger.warning("EDUmind Core DNS preflight failed for host=%s: %s", core_hostname, dns_error)
                yield (
                    "Error: EDUmind Cloud Lite no está disponible por conectividad DNS/red del servidor. "
                    "Usa IA local mientras se restablece la salida a Internet."
                )
                return

            headers = {
                "X-Api-Key": core_token,
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": model or "/models/mistral-7b-instruct-v0.1.Q4_K_M.gguf",
                "messages": enriched_messages,
                "stream": True
            }

            try:
                async with httpx.AsyncClient() as client:
                    async with client.stream(
                        "POST",
                        f"{core_url}/v1/chat/completions",
                        json=payload,
                        headers=headers,
                        timeout=httpx.Timeout(connect=8.0, read=35.0, write=10.0, pool=10.0),
                    ) as response:
                        if response.status_code != 200:
                            logger.warning("EDUmind Core returned status %s", response.status_code)
                            yield "Error: Servicio EDUmind no disponible temporalmente."
                            return
                        
                        async for line in response.aiter_lines():
                            if line.startswith("data: "):
                                line = line[6:]
                                if line == "[DONE]":
                                    break
                                try:
                                    import json
                                    chunk = json.loads(line)
                                    content = chunk['choices'][0]['delta'].get('content', '')
                                    if content:
                                        yield content
                                except:
                                    continue
            except Exception as e:
                logger.exception("Failed to connect to EDUmind Core: %s", e)
                if _has_network_resolution_issue(str(e)):
                    yield (
                        "Error: EDUmind Cloud Lite no está disponible por conectividad DNS/red del servidor. "
                        "Usa IA local mientras se restablece la salida a Internet."
                    )
                else:
                    yield "Error: Servicio EDUmind no disponible temporalmente."

        elif provider == "ollama":
            # Direct connection to local Ollama instance (Admin/Fallback usage)
            ollama_url = settings.OLLAMA_URL
            model = model or settings.OLLAMA_DEFAULT_MODEL
            
            payload = {
                "model": model,
                "messages": enriched_messages,
                "stream": True,
                "options": {
                    "temperature": 0.7
                }
            }
            
            try:
                async with httpx.AsyncClient() as client:
                    async with client.stream("POST", ollama_url, json=payload, timeout=60.0) as response:
                        if response.status_code != 200:
                            logger.warning("Ollama returned status %s", response.status_code)
                            yield "Error: Servicio local de IA no disponible temporalmente."
                            return
                        
                        async for line in response.aiter_lines():
                            if not line: continue
                            try:
                                import json
                                chunk = json.loads(line)
                                content = chunk.get('message', {}).get('content', '')
                                if content:
                                    yield content
                                if chunk.get('done', False):
                                    break
                            except:
                                continue
            except Exception as e:
                logger.exception("Failed to connect to local Ollama: %s", e)
                yield "Error: Servicio local de IA no disponible temporalmente."

        else:
            yield f"Error: Provider {provider} not supported."
