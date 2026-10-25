/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Destino tras el login: solo rutas internas. Misma regla que el backend (S-06):
// nada de "//", "/api/", barras invertidas (los navegadores las leen como "/") ni controles.
export function sanitizeNextPath(rawNext: string | null | undefined, fallback = "/dashboard"): string {
    if (!rawNext) return fallback;
    const candidate = rawNext.trim();
    if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/api/")) return fallback;
    const hasControlChar = Array.from(candidate).some((ch) => ch.charCodeAt(0) < 0x20 || /\s/.test(ch));
    if (candidate.includes("\\") || hasControlChar) return fallback;
    return candidate;
}
