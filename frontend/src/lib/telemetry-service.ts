/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import api from "./api";

export interface InvalidNavigationTelemetryPayload {
    path: string;
    referrer?: string;
    user_agent?: string;
    route_scope?: string;
}

export const telemetryService = {
    trackInvalidNavigation: async (payload: InvalidNavigationTelemetryPayload) => {
        try {
            await api.post("/telemetry/navigation-invalid", payload);
        } catch {
            // Best-effort telemetry, no user-facing error.
        }
    },
};
