/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Cliente de la API de matrices curriculares LOMLOE (/api/v1/curriculum)

import api from "./api";

export interface CurriculumStatus {
    loaded: boolean;
    index_path: string;
    loaded_at: string | null;
    generated_at: string | null;
    version: number | null;
    matrices: number;
    comunidades: number;
    criterios: number;
    saberes: number;
    last_error: string | null;
}

export interface MatrizResumen {
    id: string;
    comunidad: string;
    comunidad_key: string;
    etapa: string;
    etapa_key: string;
    area: string;
    area_key: string;
    nivel: string;
    nivel_key: string;
    idioma: string;
    revisar: boolean;
    n_competencias: number;
    n_criterios: number;
    n_saberes: number;
}

export interface NivelCatalogo {
    id: string;
    nivel: string;
    nivel_key: string;
    idioma: string;
    revisar: boolean;
    n_criterios: number;
    n_saberes: number;
}

export interface AreaCatalogo {
    area: string;
    area_key: string;
    niveles: NivelCatalogo[];
}

export interface EtapaCatalogo {
    etapa: string;
    etapa_key: string;
    areas: AreaCatalogo[];
}

export interface ComunidadCatalogo {
    comunidad: string;
    comunidad_key: string;
    etapas: EtapaCatalogo[];
}

export interface CatalogoCurricular {
    total: number;
    comunidades: ComunidadCatalogo[];
}

export interface ElementoCurricular {
    codigo: string;
    titulo: string;
    enlaces: string[];
    peso?: string | null;
    bloque?: string | null;
}

export interface BloqueSaberes {
    codigo: string;
    titulo: string;
}

export interface MatrizDetalle extends MatrizResumen {
    archivo: string;
    competencias_clave: ElementoCurricular[];
    descriptores: ElementoCurricular[];
    competencias_especificas: ElementoCurricular[];
    criterios: ElementoCurricular[];
    bloques: BloqueSaberes[];
    saberes: ElementoCurricular[];
}

export interface BusquedaHit {
    matriz_id: string;
    comunidad: string;
    etapa: string;
    area: string;
    nivel: string;
    tipo: "competencias_especificas" | "criterios" | "saberes";
    codigo: string;
    titulo: string;
    score: number;
}

export interface BusquedaCurricular {
    query: string;
    total: number;
    results: BusquedaHit[];
}

/** Referencia que aceptan los generadores (campo `matriz_curricular`). */
export interface MatrizCurricularRef {
    id: string;
    competencias?: string[];
    criterios?: string[];
    saberes?: string[];
}

export interface ListarMatricesParams {
    comunidad?: string;
    etapa?: string;
    area?: string;
    incluir_revisar?: boolean;
}

export interface BuscarParams {
    comunidad?: string;
    etapa?: string;
    area?: string;
    tipo?: BusquedaHit["tipo"];
    limit?: number;
}

export const curriculumService = {
    status: async (): Promise<CurriculumStatus> => {
        const response = await api.get<CurriculumStatus>("/curriculum/status");
        return response.data;
    },

    catalogo: async (): Promise<CatalogoCurricular> => {
        const response = await api.get<CatalogoCurricular>("/curriculum/catalogo");
        return response.data;
    },

    listarMatrices: async (params: ListarMatricesParams = {}): Promise<MatrizResumen[]> => {
        const response = await api.get<MatrizResumen[]>("/curriculum/matrices", { params });
        return response.data;
    },

    getMatriz: async (id: string): Promise<MatrizDetalle> => {
        const response = await api.get<MatrizDetalle>(`/curriculum/matrices/${id}`);
        return response.data;
    },

    buscar: async (q: string, params: BuscarParams = {}): Promise<BusquedaCurricular> => {
        const response = await api.get<BusquedaCurricular>("/curriculum/buscar", {
            params: { q, ...params },
        });
        return response.data;
    },

    contexto: async (ref: MatrizCurricularRef, maxChars = 7000): Promise<{ matriz_id: string; texto: string }> => {
        const response = await api.post<{ matriz_id: string; texto: string }>("/curriculum/contexto", {
            ...ref,
            max_chars: maxChars,
        });
        return response.data;
    },
};
