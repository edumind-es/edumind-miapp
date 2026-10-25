/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Última matriz curricular usada por el docente (solo el id oficial: comunidad/etapa/área/nivel).
// Se guarda en el navegador para no volver a elegirla en cada herramienta.

const STORAGE_KEY = "edumind_matriz_curricular";

export function getRememberedMatrixId(): string | null {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored && /^[a-z0-9_-]+(\/[a-z0-9_.-]+){3}$/i.test(stored) ? stored : null;
    } catch {
        return null;
    }
}

export function rememberMatrixId(id: string | null): void {
    try {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Sin persistencia: la elección vale solo para esta pantalla
    }
}
