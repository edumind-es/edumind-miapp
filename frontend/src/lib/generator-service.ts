/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildAuthHeaders } from "./auth-client";
import { detectDeviceCapability } from "./device-capability";
import { buildSafeLocalPrompt, type LocalPromptContract } from "./local-prompt-builder";

export interface GeneratorRequest {
    provider: string;
    api_key?: string;
    [key: string]: any;
}

export interface GeneratorRunOptions {
    signal?: AbortSignal;
}

const BYOK_PROVIDERS = new Set(["chatgpt", "deepseek", "claude", "gemini"]);
const ERROR_PREFIX = "Error:";

function shouldAutoFallbackFromCloudToLocal(provider: string, errorMessage: string): boolean {
    if (provider !== "edumind") return false;
    const normalized = (errorMessage || "").toLowerCase();
    return (
        normalized.includes("cloud lite") ||
        normalized.includes("dns") ||
        normalized.includes("conectividad") ||
        normalized.includes("servicio edumind no disponible")
    );
}

function buildRequestHeaders(): HeadersInit {
    return buildAuthHeaders("POST", { "Content-Type": "application/json" });
}

function endpointToTool(endpoint: string): string {
    return endpoint.replace(/^\/+/, "");
}

async function fetchRenderedPrompt(
    endpoint: string,
    data: GeneratorRequest,
    options?: GeneratorRunOptions
): Promise<LocalPromptContract> {
    const tool = endpointToTool(endpoint);
    const response = await fetch(`/api/v1/generators/render/${tool}`, {
        method: "POST",
        headers: buildRequestHeaders(),
        body: JSON.stringify(data),
        credentials: "include",
        signal: options?.signal,
    });

    if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || `Prompt render failed (${response.status})`);
    }
    return (await response.json()) as LocalPromptContract;
}

async function runLocalWebGpu(
    endpoint: string,
    data: GeneratorRequest,
    onChunk: (chunk: string) => void,
    options?: GeneratorRunOptions
) {
    if (options?.signal?.aborted) {
        throw new DOMException("Generation aborted", "AbortError");
    }

    const capability = detectDeviceCapability();
    if (!capability.hasWebGpu) {
        const message = "WebGPU no está disponible en este dispositivo. Cambia a un motor cloud/BYOK.";
        onChunk(`[Sistema]: ${message}\n`);
        throw new Error(message);
    }
    if (capability.isLikelyLowEnd) {
        const message =
            "WebGPU desactivado por capacidad limitada del dispositivo. Usa EDUmind cloud o un proveedor BYOK.";
        onChunk(`[Sistema]: ${message}\n`);
        throw new Error(message);
    }

    const { webLlmService } = await import("./webllm-service");
    let promptText = "";

    try {
        const rendered = await fetchRenderedPrompt(endpoint, data, options);
        promptText = buildSafeLocalPrompt(rendered);
    } catch (error) {
        console.error("Prompt render fallback:", error);
        onChunk("[Sistema]: No se pudo obtener prompt centralizado. Usando fallback local.\n");
        promptText = webLlmService.buildGenericPrompt(endpoint, data);
    }

    await webLlmService.generate(promptText, onChunk, (msg) => onChunk(`[Sistema]: ${msg}\n`));
}

// Helper to route between Server Stream and WebGPU
async function streamOrLocal(
    endpoint: string,
    data: GeneratorRequest,
    onChunk: (chunk: string) => void,
    options?: GeneratorRunOptions
) {
    const normalizedProvider = (data.provider ?? "").toLowerCase().trim();
    const normalizedApiKey = typeof data.api_key === "string" ? data.api_key.trim() : "";
    const normalizedPayload: GeneratorRequest = {
        ...data,
        provider: normalizedProvider,
        api_key: normalizedApiKey,
    };

    if (BYOK_PROVIDERS.has(normalizedProvider) && !normalizedApiKey) {
        throw new Error(
            `El motor ${normalizedProvider} requiere API key BYOK. Ábrelo en el selector y pégala antes de generar.`
        );
    }

    if (options?.signal?.aborted) {
        throw new DOMException("Generation aborted", "AbortError");
    }

    if (normalizedProvider === "webgpu") {
        await runLocalWebGpu(endpoint, normalizedPayload, onChunk, options);
        return;
    }

    const response = await fetch(`/api/v1/generators${endpoint}`, {
        method: "POST",
        headers: buildRequestHeaders(),
        body: JSON.stringify(normalizedPayload),
        credentials: "include",
        signal: options?.signal,
    });

    if (!response.ok) {
        const msg = await response.text();
        const errorMessage = msg || `Generator request failed (${response.status})`;
        const serverFallbackHint = (response.headers.get("X-EDUMIND-FALLBACK") || "").toLowerCase();
        if (
            normalizedProvider === "edumind" &&
            (serverFallbackHint.includes("webgpu") || response.status === 503)
        ) {
            onChunk("[Sistema]: EDUmind Cloud Lite limitado temporalmente. Activando fallback automático a IA local.\n");
            await runLocalWebGpu(endpoint, { ...normalizedPayload, provider: "webgpu" }, onChunk, options);
            return;
        }
        if (shouldAutoFallbackFromCloudToLocal(normalizedProvider, errorMessage)) {
            onChunk("[Sistema]: EDUmind Cloud Lite no disponible. Activando fallback automático a IA local.\n");
            await runLocalWebGpu(endpoint, { ...normalizedPayload, provider: "webgpu" }, onChunk, options);
            return;
        }
        throw new Error(errorMessage);
    }
    if (!response.body) {
        throw new Error("No se recibió contenido desde el servidor.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let hasSubstantiveOutput = false;
    let isErrorStream = false;
    let providerErrorBuffer = "";
    let firstMeaningfulChunkSeen = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (options?.signal?.aborted) {
            await reader.cancel();
            throw new DOMException("Generation aborted", "AbortError");
        }
        const decodedChunk = decoder.decode(value, { stream: true });
        if (!decodedChunk) continue;

        const trimmedChunk = decodedChunk.trim();
        if (!firstMeaningfulChunkSeen && trimmedChunk.length > 0) {
            firstMeaningfulChunkSeen = true;
            if (trimmedChunk.startsWith(ERROR_PREFIX)) {
                isErrorStream = true;
            }
        }

        if (isErrorStream) {
            providerErrorBuffer += decodedChunk;
            continue;
        }

        if (trimmedChunk.length > 0) {
            hasSubstantiveOutput = true;
        }
        onChunk(decodedChunk);
    }

    const tailChunk = decoder.decode();
    if (tailChunk) {
        const trimmedTail = tailChunk.trim();
        if (!firstMeaningfulChunkSeen && trimmedTail.length > 0) {
            firstMeaningfulChunkSeen = true;
            if (trimmedTail.startsWith(ERROR_PREFIX)) {
                isErrorStream = true;
            }
        }

        if (isErrorStream) {
            providerErrorBuffer += tailChunk;
        } else if (trimmedTail.length > 0) {
            hasSubstantiveOutput = true;
            onChunk(tailChunk);
        } else {
            onChunk(tailChunk);
        }
    }

    if (isErrorStream) {
        const providerError = providerErrorBuffer.trim() || "Error: El proveedor devolvió una respuesta inválida.";

        if (shouldAutoFallbackFromCloudToLocal(normalizedProvider, providerError)) {
            onChunk("[Sistema]: EDUmind Cloud Lite no disponible. Activando fallback automático a IA local.\n");
            await runLocalWebGpu(endpoint, { ...normalizedPayload, provider: "webgpu" }, onChunk, options);
            return;
        }

        throw new Error(providerError);
    }

    if (!hasSubstantiveOutput) {
        throw new Error(
            "El proveedor no devolvió contenido. Revisa API key/cuota o prueba otro proveedor."
        );
    }
}

export const generatorService = {
    generatePlanning: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/planning", data, onChunk, options),

    generateSituation: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/situation", data, onChunk, options),

    generateStem: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/stem", data, onChunk, options),

    generateDiversity: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/diversity", data, onChunk, options),

    generateSession: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/session", data, onChunk, options),

    generateCase: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/case", data, onChunk, options),

    generateTopic: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/topic", data, onChunk, options),

    generateDefense: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/defense", data, onChunk, options),

    generateIdea: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/idea", data, onChunk, options),

    generateMinutes: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/minutes", data, onChunk, options),

    generateInstitutionDoc: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/institution_doc", data, onChunk, options),

    generateInspectionReport: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/inspection_report", data, onChunk, options),

    generateReinforcementPlan: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/reinforcement_plan", data, onChunk, options),

    generateRubrics: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/rubrics", data, onChunk, options),

    generateWorksheets: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/worksheets", data, onChunk, options),

    generateMethodology: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/methodology", data, onChunk, options),

    generateOrganization: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/organization", data, onChunk, options),

    generateQuestions: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/questions", data, onChunk, options),

    generateNormativa: (data: GeneratorRequest, onChunk: (chunk: string) => void, options?: GeneratorRunOptions) =>
        streamOrLocal("/normativa", data, onChunk, options),
};
