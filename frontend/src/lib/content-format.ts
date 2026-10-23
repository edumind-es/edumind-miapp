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
