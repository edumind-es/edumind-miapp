/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Modo local honesto (P-02): el navegador sanea, valida y compone el prompt sin
// enviar el formulario al servidor. El servidor solo publica las reglas de cada
// herramienta una vez (GET /generators/local-contracts); el contexto curricular,
// si se usa, se pide únicamente con el id de matriz y códigos oficiales.
// Las reglas replican app/core/prompt_registry.py del backend.

import { buildApiUrl } from "./api-base";
import { curriculumService, type MatrizCurricularRef } from "./curriculum-service";
import type { LocalPromptContract, ToolPromptSpec } from "./local-prompt-builder";

export interface LocalToolContract {
    tool: string;
    prompt_id: string;
    version: string;
    risk_level: string;
    supports_json: boolean;
    default_response_format: string;
    output_schema: Record<string, unknown> | null;
    required_fields: Record<string, string>;
    positive_fields: Record<string, string>;
    spec?: ToolPromptSpec | null;
    text_quality?: boolean;
}

interface LocalContractsResponse {
    local_prompt_mode: string;
    placeholder_values: string[];
    contracts: LocalToolContract[];
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class LocalPromptValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LocalPromptValidationError";
    }
}

const PRIVATE_KEYS = new Set(["provider", "api_key", "apiKey", "response_format"]);

let contractsPromise: Promise<LocalContractsResponse> | null = null;

export async function fetchLocalContracts(signal?: AbortSignal): Promise<LocalContractsResponse> {
    if (!contractsPromise) {
        contractsPromise = fetch(buildApiUrl("/generators/local-contracts"), { signal })
            .then(async (response) => {
                if (!response.ok) throw new Error(`No se pudieron cargar las reglas locales (${response.status})`);
                return (await response.json()) as LocalContractsResponse;
            })
            .catch((error) => {
                contractsPromise = null; // permite reintentar en la siguiente generación
                throw error;
            });
    }
    return contractsPromise;
}

// --- Saneado (espejo de _sanitize_payload) ---------------------------------------

function normalizeToken(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function isPlaceholder(value: unknown, placeholders: Set<string>): boolean {
    if (typeof value !== "string") return false;
    const normalized = normalizeToken(value);
    if (!normalized) return true;
    return (
        placeholders.has(normalized) ||
        normalized.startsWith("no especificad") ||
        normalized.startsWith("no aportad") ||
        normalized.startsWith("pendiente")
    );
}

function isEmpty(value: unknown): boolean {
    return (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && !Array.isArray(value) && value !== null && Object.keys(value).length === 0)
    );
}

function sanitizeValue(value: unknown, placeholders: Set<string>): JsonValue | undefined {
    if (typeof value === "string") {
        const cleaned = value.split("\u0000").join("").replace(/```/g, "'''").trim();
        return isPlaceholder(cleaned, placeholders) ? "" : cleaned;
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeValue(item, placeholders))
            .filter((item) => item !== undefined && !isEmpty(item)) as JsonValue[];
    }
    if (value && typeof value === "object") {
        const result: { [key: string]: JsonValue } = {};
        for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
            const sanitized = sanitizeValue(raw, placeholders);
            if (sanitized !== undefined && !isEmpty(sanitized)) result[String(key)] = sanitized;
        }
        return result;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    return undefined;
}

export function sanitizePayloadLocally(
    payload: Record<string, unknown>,
    placeholders: Set<string>
): Record<string, JsonValue> {
    const sanitized = sanitizeValue(payload, placeholders);
    return (sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized : {}) as Record<
        string,
        JsonValue
    >;
}

// --- Validación (espejo de _validate_payload) ------------------------------------

function hasMeaningfulValue(value: unknown, placeholders: Set<string>): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return !isPlaceholder(value, placeholders);
    if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item, placeholders));
    if (typeof value === "object") return Object.values(value as object).some((item) => hasMeaningfulValue(item, placeholders));
    return true;
}

function isPositiveNumber(value: unknown): boolean {
    if (typeof value === "boolean" || value === null || value === undefined) return false;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
        const direct = Number(value.trim().replace(",", "."));
        if (!Number.isNaN(direct)) return direct > 0;
        const match = value.match(/-?\d+(?:[.,]\d+)?/);
        return match ? Number(match[0].replace(",", ".")) > 0 : false;
    }
    return false;
}

export function validatePayloadLocally(
    contract: LocalToolContract,
    payload: Record<string, JsonValue>,
    placeholders: Set<string>
): void {
    const missing = Object.entries(contract.required_fields)
        .filter(([field]) => !hasMeaningfulValue(payload[field], placeholders))
        .map(([, label]) => label);
    if (contract.tool === "defense" && payload.modo === "evaluar" && !hasMeaningfulValue(payload.respuesta_usuario, placeholders)) {
        missing.push("respuesta del usuario");
    }
    if (missing.length) {
        throw new LocalPromptValidationError(
            "Faltan datos obligatorios para generar un resultado fiable: " + [...new Set(missing)].sort().join(", ") + "."
        );
    }
    const invalid = Object.entries(contract.positive_fields)
        .filter(([field]) => !isPositiveNumber(payload[field]))
        .map(([, label]) => label);
    if (invalid.length) {
        throw new LocalPromptValidationError(
            "Estos campos deben ser mayores que cero: " + [...new Set(invalid)].sort().join(", ") + "."
        );
    }
}

function resolveResponseFormat(payload: Record<string, unknown>, contract: LocalToolContract): string {
    const requested = String(payload.response_format || contract.default_response_format || "text").toLowerCase().trim();
    if (requested !== "text" && requested !== "json") return "text";
    if (requested === "json" && !contract.output_schema) return "text";
    return requested;
}

// --- Contexto curricular (espejo de enrich_generator_payload, sin datos personales) ----

function appendLines(target: Record<string, unknown>, field: string, lines: string[]): void {
    if (!lines.length) return;
    const current = target[field];
    if (Array.isArray(current)) {
        target[field] = [...new Set([...current.map(String), ...lines])];
    } else {
        const previous = String(current ?? "").trim();
        target[field] = (previous ? previous + "\n" : "") + lines.join("\n");
    }
}

async function enrichWithCurriculum(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data: Record<string, unknown> = { ...payload };
    const ref = data.matriz_curricular as MatrizCurricularRef | undefined;
    delete data.matriz_curricular;
    if (!ref || typeof ref !== "object" || !ref.id) return data;

    try {
        // Solo salen del navegador el id de la matriz y códigos oficiales (LOMLOE), nunca el formulario.
        const [matriz, contexto] = await Promise.all([
            curriculumService.getMatriz(ref.id),
            curriculumService.contexto(ref),
        ]);
        const upper = (codes?: string[]) => new Set((codes ?? []).map((c) => c.toUpperCase()));
        const selCrit = upper(ref.criterios);
        const selSab = upper(ref.saberes);
        const criterios = (matriz.criterios ?? []).filter((c) => selCrit.has((c.codigo ?? "").toUpperCase()));
        const saberes = (matriz.saberes ?? []).filter((s) => selSab.has((s.codigo ?? "").toUpperCase()));
        appendLines(data, "criterios_evaluacion", criterios.map((c) => `${c.codigo ?? ""} ${c.titulo}`.trim()));
        appendLines(
            data,
            "contenidos_refuerzo" in data ? "contenidos_refuerzo" : "contenidos",
            saberes.map((s) => `${s.codigo ?? ""} ${s.titulo}`.trim())
        );
        data.marco_curricular = contexto.texto;
    } catch (error) {
        console.warn("Contexto curricular no disponible en modo local:", error);
    }
    return data;
}

// --- Punto de entrada -------------------------------------------------------------------

export async function prepareLocalPromptContract(
    tool: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal
): Promise<LocalPromptContract> {
    const rules = await fetchLocalContracts(signal);
    const contract = rules.contracts.find((item) => item.tool === tool);
    if (!contract) throw new Error(`Herramienta desconocida para el modo local: ${tool}`);

    const placeholders = new Set(rules.placeholder_values);
    const enriched = await enrichWithCurriculum(payload);
    const sanitized = sanitizePayloadLocally(enriched, placeholders);
    validatePayloadLocally(contract, sanitized, placeholders);
    const responseFormat = resolveResponseFormat(sanitized, contract);

    const publicPayload: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(sanitized)) {
        if (!PRIVATE_KEYS.has(key)) publicPayload[key] = value;
    }

    return {
        tool: contract.tool,
        prompt_id: contract.prompt_id,
        prompt_version: contract.version,
        risk_level: contract.risk_level,
        response_format: responseFormat,
        output_schema: contract.output_schema,
        sanitized_payload: publicPayload as LocalPromptContract["sanitized_payload"],
        local_prompt_mode: rules.local_prompt_mode,
        spec: contract.spec ?? null,
        text_quality: contract.text_quality ?? false,
    };
}
