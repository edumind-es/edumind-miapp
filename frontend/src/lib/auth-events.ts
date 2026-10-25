/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Un único punto por el que los dos clientes HTTP (fetch y axios) avisan de un 401.
// El proveedor de sesión escucha y decide: limpiar estado y, en rutas protegidas, volver al login.

const SESSION_EXPIRED_EVENT = "edumind:session-expired";
const bus: EventTarget | null = typeof window !== "undefined" ? new EventTarget() : null;

// Rutas de autenticación cuyo 401 es parte del flujo normal, no una sesión caducada.
const AUTH_FLOW_PATHS = ["/auth/me", "/auth/login", "/auth/logout", "/auth/config", "/auth/sso/"];

export function isAuthFlowPath(url: string): boolean {
    return AUTH_FLOW_PATHS.some((path) => url.includes(path));
}

export function notifySessionExpired(): void {
    bus?.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function onSessionExpired(handler: () => void): () => void {
    if (!bus) return () => undefined;
    bus.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => bus.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}
