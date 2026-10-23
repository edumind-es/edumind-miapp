/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

const rawApiBaseUrl = (import.meta.env.VITE_API_URL || "/api/v1").trim();

export const API_BASE_URL = rawApiBaseUrl.endsWith("/")
    ? rawApiBaseUrl.slice(0, -1)
    : rawApiBaseUrl;

function hasExplicitOrigin(value: string): boolean {
    return /^https?:\/\//i.test(value) || value.startsWith("//");
}

export function buildApiUrl(path: string): string {
    if (!path) return API_BASE_URL;
    if (hasExplicitOrigin(path)) return path;

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (normalizedPath === API_BASE_URL || normalizedPath.startsWith(`${API_BASE_URL}/`)) {
        return normalizedPath;
    }

    return `${API_BASE_URL}${normalizedPath}`;
}
