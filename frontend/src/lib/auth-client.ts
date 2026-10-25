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

import { buildApiUrl } from "@/lib/api-base";
import { isAuthFlowPath, notifySessionExpired } from "@/lib/auth-events";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE_NAME = "edumind_csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";

export interface SessionUser {
    id: number;
    username: string;
    email?: string | null;
    role: string;
    is_active: boolean;
}

export interface AuthConfig {
    auth_mode: string;
    local_login_enabled: boolean;
    sso_enabled: boolean;
    sso_provider?: string | null;
    sso_login_path?: string | null;
}

export interface DefaultDestination {
    path: string;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    if (Array.isArray(headers)) {
        const result: Record<string, string> = {};
        for (const [key, value] of headers) result[key] = value;
        return result;
    }
    return { ...headers };
}

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function getStoredToken(): string | null {
    return null;
}

export function buildAuthHeaders(method: string, headers?: HeadersInit): Record<string, string> {
    const merged = normalizeHeaders(headers);

    if (!SAFE_METHODS.has(method.toUpperCase())) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME);
        if (csrfToken && !merged[CSRF_HEADER_NAME]) {
            merged[CSRF_HEADER_NAME] = csrfToken;
        }
    }

    return merged;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const method = (init.method || "GET").toUpperCase();
    const headers = buildAuthHeaders(method, init.headers);
    const resolvedInput = typeof input === "string" ? buildApiUrl(input) : input;
    const response = await fetch(resolvedInput, {
        ...init,
        method,
        headers,
        credentials: "include",
    });
    // Sesión caducada o revocada: se avisa una sola vez al proveedor de sesión.
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    if (response.status === 401 && !isAuthFlowPath(url)) {
        notifySessionExpired();
    }
    return response;
}

export function clearLegacyAuthState() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
}

export async function fetchCurrentUser(): Promise<SessionUser | null> {
    const response = await authFetch("/auth/me");
    if (response.status === 401) {
        return null;
    }
    if (!response.ok) {
        throw new Error("No se pudo validar la sesión actual.");
    }
    return await response.json() as SessionUser;
}

// Supresión de cuenta: el servidor exige repetir el nombre de usuario y borra todos los datos personales.
export async function deleteCurrentAccount(confirmUsername: string): Promise<void> {
    const response = await authFetch("/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_username: confirmUsername }),
    });
    if (!response.ok) {
        let detail = "No se pudo eliminar la cuenta.";
        try {
            const payload = await response.json() as { detail?: string };
            if (payload?.detail) detail = payload.detail;
        } catch {
            // sin cuerpo JSON: se mantiene el mensaje genérico
        }
        throw new Error(detail);
    }
    clearLegacyAuthState();
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
    const response = await fetch(buildApiUrl("/auth/config"), {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error("No se pudo cargar la configuración de acceso.");
    }
    return await response.json() as AuthConfig;
}

export async function fetchDefaultDestination(): Promise<DefaultDestination> {
    const response = await authFetch("/auth/default-destination");
    if (!response.ok) {
        throw new Error("No se pudo resolver el destino de acceso.");
    }
    return await response.json() as DefaultDestination;
}

export function startSsoLogin(nextPath?: string) {
    const loginUrl = new URL(buildApiUrl("/auth/sso/login"), window.location.origin);
    if (nextPath) {
        loginUrl.searchParams.set("next", nextPath);
    }
    window.location.assign(loginUrl.toString());
}
