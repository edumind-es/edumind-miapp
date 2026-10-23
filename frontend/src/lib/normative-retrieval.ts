/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import api from "./api";

export interface NormativeResultItem {
    document_id: string;
    document_type: string;
    category: string;
    section_kind: "article" | "phase";
    section_label: string;
    title: string;
    content: string;
    score: number;
}

export interface NormativeSearchResponse {
    query: string;
    page: number;
    page_size: number;
    total_results: number;
    total_pages: number;
    cache_hit: boolean;
    results: NormativeResultItem[];
    context: string;
}

export interface NormativeStatusResponse {
    loaded: boolean;
    source_path: string | null;
    loaded_at: string | null;
    indexed_sections: number;
    indexed_documents: number;
    indexed_categories: number;
    cache_entries: number;
    cache_ttl_seconds: number;
    cache_max_entries: number;
    last_error: string | null;
}

export interface CurriculumAreaItem {
    area_id: string;
    area_name: string;
    evaluation_criteria: string[];
    contents: string[];
}

export interface CurriculumCatalogResponse {
    region: string;
    stage: string;
    source: string;
    normative_notes: string[];
    areas: CurriculumAreaItem[];
}

export const normativeService = {
    search: async (query: string, page = 1, pageSize = 5): Promise<NormativeSearchResponse> => {
        const response = await api.get<NormativeSearchResponse>("/normative/search", {
            params: {
                query,
                page,
                page_size: pageSize,
            },
        });
        return response.data;
    },

    status: async (): Promise<NormativeStatusResponse> => {
        const response = await api.get<NormativeStatusResponse>("/normative/status");
        return response.data;
    },

    getGaliciaPrimaryCurriculum: async (): Promise<CurriculumCatalogResponse> => {
        const response = await api.get<CurriculumCatalogResponse>("/normative/curriculum/galicia/primary");
        return response.data;
    },
};
