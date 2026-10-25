# AI Provider Implementation Status

## Overview
All external AI provider connections are implemented in `ai_service.py`. Each provider accepts user-provided API keys and streams responses back through the backend.

## Privacidad y datos (política vigente desde 24-10-2026)

### Motor local (WebLLM) y fuentes

- Las fuentes tipográficas se sirven desde la propia app (`frontend/src/assets/fonts`), no desde Google Fonts.
- El modelo local (Llama 3.2 1B) se descarga por defecto de Hugging Face y GitHub. Para servirlo desde EDUmind:
  1. `./scripts/mirror_webllm_model.sh` (≈1 GB en `/var/www/edumind_models/webllm`, con `SHA256SUMS`).
  2. Compilar el frontend con `VITE_WEBLLM_MODEL_URL` y `VITE_WEBLLM_MODEL_LIB_URL` apuntando a `/models/`.
  3. Entonces la CSP puede dejar de permitir `connect-src https:` y limitarse a los dominios propios.

- Los proveedores externos (OpenAI, Anthropic, Google, Mistral) reciben el prompt completo del usuario. Solo se usan con la **clave del propio usuario**: no existe fallback a claves del sistema, tampoco para administradores.
- El catálogo (`api/v1/config.py`) declara para cada motor `processing` (device | edumind | third_party), `provider` y `region`; el selector muestra un aviso antes de la primera petición a cualquier motor que no sea el dispositivo.
- **DeepSeek se retiró** del catálogo y del servicio: transferencia a China sin mecanismo válido para datos de alumnado.
- El motor por defecto es WebGPU (modelo en el navegador).

## Implemented Providers

### 1. DeepSeek
- **Status**: ❌ Retirado (24-10-2026). Ver "Privacidad y datos".

### 2. Mistral
- **Status**: ✅ Implemented  
- **Protocol**: OpenAI-compatible API
- **Endpoint**: `https://api.mistral.ai/v1`
- **Model**: `mistral-small-latest`
- **Implementation**: Uses `AsyncOpenAI` client
- **API Key Format**: Mistral API key

### 3. Claude (Anthropic)
- **Status**: ✅ Implemented
- **Protocol**: Anthropic SDK
- **Model**: `claude-3-5-sonnet-20241022`
- **Implementation**: Uses `AsyncAnthropic` client with streaming
- **API Key Format**: Anthropic API key (sk-ant-...)
- **Dependency**: `anthropic` package

### 4. Gemini (Google)
- **Status**: ✅ Implemented
- **Protocol**: Google Generative AI SDK
- **Model**: `gemini-pro`
- **Implementation**: Uses `google.generativeai` library
- **API Key Format**: Google AI API key
- **Dependency**: `google-generativeai` package
- **Note**: Currently uses simplified message conversion (only last user message)

### 5. EDUmind (Internal)
- **Status**: ✅ Implemented
- **Protocol**: Custom OpenAI-compatible streaming
- **Endpoint**: Configured via `EDUMIND_CORE_URL`
- **Authentication**: Bearer token via `EDUMIND_CORE_TOKEN`
- **Implementation**: Direct HTTPX streaming client

### 6. WebGPU (Client-side)
- **Status**: ✅ Implemented (Frontend)
- **Location**: `frontend/src/lib/webllm-service.ts`
- **Implementation**: Runs entirely in browser using WebLLM

## Dependencies Required

The following packages must be installed in the backend virtual environment:
```
openai>=1.0.0          # For DeepSeek, Mistral
anthropic>=0.8.0       # For Claude
google-generativeai    # For Gemini
httpx                  # For EDUmind Core
```

## Security Implementation

✅ **API keys are never stored**: Keys are passed directly from frontend request → backend handler → AI service
✅ **Session-only**: API keys exist only during the request lifecycle
✅ **User-provided**: Users bring their own keys via the EngineSelector component
✅ **Fallback**: System-level keys can be configured in `.env` as fallback

## Known Limitations

1. **Gemini Message Format**: Currently only sends the last user message. Multi-turn conversations would require full history conversion.
2. **Error Handling**: Basic error messages are returned. Could be enhanced with more specific error codes.
3. **Rate Limiting**: No client-side rate limiting implemented. Relies on provider-side limits.

## Testing Status

- ✅ API key propagation (Frontend → Backend)
- ✅ Streaming output cleaning (Markdown filter)
- ✅ Database logging
- ⚠️ **External provider connectivity**: Not tested with real API keys (requires user keys for verification)

## Next Steps for Full Verification

To fully verify external provider connectivity, users should:
1. Obtain API keys from each provider they wish to use
2. Enter keys in the EngineSelector dropdown
3. Generate content using each provider
4. Confirm clean, structured output appears

The backend is fully prepared to handle all providers correctly.
