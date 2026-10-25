/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Perfil pedagógico del docente (solo preferencias de trabajo). Una copia en memoria
// evita pedirlo en cada herramienta; se invalida al guardar o al cerrar sesión.

import { authFetch } from "./auth-client";
import { rememberMatrixId } from "./curriculum-preference";

export interface TeacherProfile {
    comunidad_key: string | null;
    etapa_key: string | null;
    area_key: string | null;
    curso: string | null;
    matriz_id: string | null;
    metodologia_slider: number | null;
    tipo_agrupamiento: string | null;
    contexto_aula: string | null;
    updated_at?: string | null;
}

export const EMPTY_PROFILE: TeacherProfile = {
    comunidad_key: null,
    etapa_key: null,
    area_key: null,
    curso: null,
    matriz_id: null,
    metodologia_slider: null,
    tipo_agrupamiento: null,
    contexto_aula: null,
};

let cached: Promise<TeacherProfile | null> | null = null;

export function invalidateProfileCache(): void {
    cached = null;
}

export function fetchTeacherProfile(): Promise<TeacherProfile | null> {
    if (!cached) {
        cached = authFetch("/profile/me")
            .then(async (response) => {
                if (response.status === 401) return null;
                if (!response.ok) throw new Error("No se pudo cargar el perfil docente.");
                const profile = (await response.json()) as TeacherProfile;
                // La matriz preferida del perfil manda sobre la recordada en este navegador.
                if (profile.matriz_id) rememberMatrixId(profile.matriz_id);
                return profile;
            })
            .catch((error) => {
                cached = null;
                throw error;
            });
    }
    return cached;
}

export async function saveTeacherProfile(profile: Partial<TeacherProfile>): Promise<TeacherProfile> {
    const response = await authFetch("/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
    });
    if (!response.ok) {
        let detail = "No se pudo guardar el perfil.";
        try {
            const payload = (await response.json()) as { detail?: string };
            if (payload?.detail) detail = payload.detail;
        } catch {
            // sin cuerpo JSON
        }
        throw new Error(detail);
    }
    const saved = (await response.json()) as TeacherProfile;
    cached = Promise.resolve(saved);
    rememberMatrixId(saved.matriz_id);
    return saved;
}
