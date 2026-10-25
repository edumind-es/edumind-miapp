/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const INTERNAL_LINE_PATTERNS = [
    /^\[sistema\]:/i,
    /^\[system instructions\]/i,
    /^instrucciones de formato:?$/i,
    /^documentación de referencia/i,
    /^rol específico:?$/i,
    /^recursos y herramientas edumind disponibles:?$/i,
    /^recursos externos recomendados:?$/i,
    /^contrato de calidad de respuesta \(obligatorio\):?$/i,
];

function stripInternalArtifacts(raw: string): string {
    let cleaned = (raw || "").replace(/\r\n/g, "\n");
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/<\|[^|]+?\|>/g, "");
    cleaned = cleaned.replace(
        /^\s*Eres EDUmind,[\s\S]*?6\.\s*Cuando cites normativa, indica el documento de origen\s*/i,
        "",
    );

    const filteredLines = cleaned
        .split("\n")
        .filter((line) => !INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())));

    return filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function stripSystemLines(raw: string): string {
    return stripInternalArtifacts(raw);
}

export function cleanGeneratedText(raw: string): string {
    const normalized = stripSystemLines(raw);
    if (!normalized) return "";

    const fencedMatch = normalized.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }

    return normalized.trim();
}

export interface ReviewFlags {
    /** El modelo (salida JSON) ha marcado requiere_revision_humana. */
    humanReview: boolean;
    /** Códigos curriculares citados que no existen en la matriz oficial elegida. */
    unknownCurriculumCodes: string[];
}

// Avisos que el docente debe ver antes de usar una salida: revisión humana (campo de los
// esquemas JSON) y revisión curricular (códigos inventados, detectados por el servidor).
export function detectReviewFlags(raw: string): ReviewFlags {
    const flags: ReviewFlags = { humanReview: false, unknownCurriculumCodes: [] };
    const text = cleanGeneratedText(raw);
    if (!text) return flags;

    try {
        const parsed: unknown = JSON.parse(text);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const record = parsed as Record<string, unknown>;
            flags.humanReview = record.requiere_revision_humana === true;
            const revision = record._revision_curricular as { codigos_no_encontrados?: unknown } | undefined;
            if (Array.isArray(revision?.codigos_no_encontrados)) {
                flags.unknownCurriculumCodes = revision.codigos_no_encontrados.filter(
                    (c): c is string => typeof c === "string"
                );
            }
            return flags;
        }
    } catch {
        // Texto plano: se busca la línea de revisión curricular añadida por el servidor
    }

    // Los códigos llevan puntos (CE1.1): se captura hasta el ". Revísalos" que cierra la frase.
    const match = text.match(/\[Revisión curricular\][^\n]*?matriz\s+\S+:\s*(.+?)\.\s*Rev[ií]salos/);
    if (match) {
        flags.unknownCurriculumCodes = match[1].split(",").map((c) => c.trim()).filter(Boolean);
    }
    return flags;
}
