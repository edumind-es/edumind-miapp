/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Rúbrica estructurada (salida JSON del generador): lectura, CSV para iDoceo/Additio y texto para Word.

import { cleanGeneratedText } from "./content-format";

export interface RubricCriterion {
    criterio: string;
    codigo_curricular?: string;
    descriptores: string[];
    peso?: number;
}

export interface Rubric {
    titulo: string;
    area?: string;
    niveles: string[];
    criterios: RubricCriterion[];
    observaciones?: string;
    requiere_revision_humana: boolean;
}

export function parseRubric(raw: string): Rubric | null {
    const text = cleanGeneratedText(raw);
    if (!text) return null;
    try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        if (!Array.isArray(record.niveles) || !Array.isArray(record.criterios)) return null;
        const niveles = record.niveles.map(String);
        const criterios: RubricCriterion[] = record.criterios
            .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
            .map((c) => ({
                criterio: String(c.criterio ?? ""),
                codigo_curricular: typeof c.codigo_curricular === "string" && c.codigo_curricular.trim() ? c.codigo_curricular.trim() : undefined,
                descriptores: Array.isArray(c.descriptores) ? c.descriptores.map(String) : [],
                peso: typeof c.peso === "number" ? c.peso : undefined,
            }));
        return {
            titulo: String(record.titulo ?? "Rúbrica"),
            area: typeof record.area === "string" ? record.area : undefined,
            niveles,
            criterios,
            observaciones: typeof record.observaciones === "string" ? record.observaciones : undefined,
            requiere_revision_humana: record.requiere_revision_humana === true,
        };
    } catch {
        return null;
    }
}

function csvCell(value: string | number | undefined): string {
    const text = value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

// CSV con punto y coma (Excel/iDoceo/Additio en español) y BOM para que se lean las tildes.
export function rubricToCsv(rubric: Rubric): string {
    const header = ["Criterio", "Código curricular", ...rubric.niveles, "Peso (%)"];
    const rows = rubric.criterios.map((c) => [
        c.criterio,
        c.codigo_curricular ?? "",
        ...rubric.niveles.map((_, i) => c.descriptores[i] ?? ""),
        c.peso ?? "",
    ]);
    return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

// Texto plano con títulos en mayúsculas y viñetas: lo que el exportador a Word convierte en documento.
export function rubricToPlainText(rubric: Rubric): string {
    const lines: string[] = [];
    if (rubric.area) lines.push(`Área: ${rubric.area}`);
    lines.push(`Niveles de desempeño: ${rubric.niveles.join(" · ")}`, "");
    rubric.criterios.forEach((c, index) => {
        const codigo = c.codigo_curricular ? ` (${c.codigo_curricular})` : "";
        const peso = c.peso !== undefined ? ` · ${c.peso} %` : "";
        lines.push(`${index + 1}. ${c.criterio.toUpperCase()}${codigo}${peso}`);
        rubric.niveles.forEach((nivel, i) => lines.push(`- ${nivel}: ${c.descriptores[i] ?? ""}`));
        lines.push("");
    });
    if (rubric.observaciones) lines.push("OBSERVACIONES", rubric.observaciones);
    return lines.join("\n").trim();
}
