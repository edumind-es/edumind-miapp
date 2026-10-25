/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Selector de matriz curricular oficial (comunidad → etapa → área → nivel) con elección
// de criterios y saberes. Lo elegido viaja como `matriz_curricular` y el prompt recibe
// los elementos literales del currículo autonómico en lugar de texto libre.

import { useEffect, useMemo, useState } from "react";
import {
    curriculumService,
    type CatalogoCurricular,
    type ElementoCurricular,
    type MatrizCurricularRef,
    type MatrizDetalle,
} from "@/lib/curriculum-service";
import { getRememberedMatrixId, rememberMatrixId } from "@/lib/curriculum-preference";

interface CurriculumMatrixSelectorProps {
    value: MatrizCurricularRef | null;
    onChange: (value: MatrizCurricularRef | null) => void;
    /** Texto corto bajo el título, por si la herramienta quiere matizar el uso. */
    hint?: string;
}

let catalogPromise: Promise<CatalogoCurricular> | null = null;
function loadCatalog(): Promise<CatalogoCurricular> {
    if (!catalogPromise) {
        catalogPromise = curriculumService.catalogo().catch((error) => {
            catalogPromise = null;
            throw error;
        });
    }
    return catalogPromise;
}

function splitId(id: string | null): [string, string, string, string] | null {
    if (!id) return null;
    const parts = id.split("/");
    return parts.length === 4 ? (parts as [string, string, string, string]) : null;
}

export function CurriculumMatrixSelector({ value, onChange, hint }: CurriculumMatrixSelectorProps) {
    const [catalog, setCatalog] = useState<CatalogoCurricular | null>(null);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(() => Boolean(value?.id || getRememberedMatrixId()));

    const initial = splitId(value?.id ?? getRememberedMatrixId());
    const [comunidad, setComunidad] = useState(initial?.[0] ?? "");
    const [etapa, setEtapa] = useState(initial?.[1] ?? "");
    const [area, setArea] = useState(initial?.[2] ?? "");
    const [nivel, setNivel] = useState(initial?.[3] ?? "");

    const [detalle, setDetalle] = useState<MatrizDetalle | null>(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [showCriterios, setShowCriterios] = useState(true);
    const [showSaberes, setShowSaberes] = useState(false);

    useEffect(() => {
        let active = true;
        loadCatalog()
            .then((data) => active && setCatalog(data))
            .catch(() => active && setCatalogError("No se pudo cargar el catálogo curricular."));
        return () => {
            active = false;
        };
    }, []);

    const comunidades = useMemo(() => catalog?.comunidades ?? [], [catalog]);
    const etapas = useMemo(() => comunidades.find((c) => c.comunidad_key === comunidad)?.etapas ?? [], [comunidades, comunidad]);
    const areas = useMemo(() => etapas.find((e) => e.etapa_key === etapa)?.areas ?? [], [etapas, etapa]);
    const niveles = useMemo(() => areas.find((a) => a.area_key === area)?.niveles ?? [], [areas, area]);
    const matrizId = useMemo(() => niveles.find((n) => n.nivel_key === nivel)?.id ?? null, [niveles, nivel]);

    // Al cambiar de matriz se cargan sus elementos y se reinicia la selección
    useEffect(() => {
        if (!matrizId) {
            setDetalle(null);
            if (value) onChange(null);
            return;
        }
        let active = true;
        setDetalleLoading(true);
        curriculumService
            .getMatriz(matrizId)
            .then((data) => {
                if (!active) return;
                setDetalle(data);
                rememberMatrixId(matrizId);
                if (value?.id !== matrizId) onChange({ id: matrizId, criterios: [], saberes: [] });
            })
            .catch(() => active && setDetalle(null))
            .finally(() => active && setDetalleLoading(false));
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matrizId]);

    const toggle = (kind: "criterios" | "saberes", codigo: string) => {
        if (!value) return;
        const current = value[kind] ?? [];
        const next = current.includes(codigo) ? current.filter((c) => c !== codigo) : [...current, codigo];
        onChange({ ...value, [kind]: next });
    };

    const selectAll = (kind: "criterios" | "saberes", items: ElementoCurricular[]) => {
        if (!value) return;
        const all = items.map((i) => i.codigo).filter(Boolean);
        const already = (value[kind] ?? []).length === all.length;
        onChange({ ...value, [kind]: already ? [] : all });
    };

    const clear = () => {
        setComunidad("");
        setEtapa("");
        setArea("");
        setNivel("");
        rememberMatrixId(null);
        onChange(null);
    };

    const selectedCount = (value?.criterios?.length ?? 0) + (value?.saberes?.length ?? 0);

    const renderList = (kind: "criterios" | "saberes", items: ElementoCurricular[], open: boolean, setOpen: (v: boolean) => void) => (
        <div className="border-t border-hair pt-3 mt-3">
            <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(!open)} className="lam-mono hover:text-ink">
                    {open ? "▾" : "▸"} {kind === "criterios" ? "Criterios de evaluación" : "Saberes básicos"} ({items.length})
                </button>
                {open ? (
                    <button type="button" onClick={() => selectAll(kind, items)} className="lam-mono underline underline-offset-4">
                        {(value?.[kind]?.length ?? 0) === items.length ? "Quitar todos" : "Seleccionar todos"}
                    </button>
                ) : null}
            </div>
            {open ? (
                <ul className="m-0 mt-2 p-0 list-none max-h-64 overflow-y-auto space-y-1">
                    {items.map((item) => {
                        const id = `matriz-${kind}-${item.codigo}`;
                        return (
                            <li key={id} className="flex gap-2 items-start text-[13px] leading-snug">
                                <input
                                    id={id}
                                    type="checkbox"
                                    className="mt-1"
                                    checked={(value?.[kind] ?? []).includes(item.codigo)}
                                    onChange={() => toggle(kind, item.codigo)}
                                />
                                <label htmlFor={id} className="cursor-pointer">
                                    <span className="font-mono text-ink-2 mr-1">{item.codigo}</span>
                                    {item.titulo}
                                </label>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );

    return (
        <div className="border border-hair bg-card">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between lam-label hover:text-ink transition-colors"
                aria-expanded={expanded}
            >
                <span>
                    Currículo oficial {value?.id ? <span className="text-ink-2 font-normal">· {detalle ? `${detalle.comunidad} · ${detalle.area} · ${detalle.nivel}` : value.id}</span> : null}
                </span>
                <span className="lam-mono">{selectedCount ? `${selectedCount} elementos` : expanded ? "Ocultar" : "Elegir"}</span>
            </button>

            {expanded ? (
                <div className="px-4 pb-4">
                    <p className="m-0 mb-3 text-[13px] text-ink-2 leading-snug">
                        {hint ?? "Elige la matriz autonómica (LOMLOE) y marca los criterios y saberes que quieres trabajar: se añaden literalmente al prompt y el modelo no tiene que inventarlos."}
                    </p>
                    {catalogError ? <p className="m-0 text-[13px] text-alert">{catalogError}</p> : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="lam-mono block mb-1">Comunidad</span>
                            <select className="lam-input" value={comunidad} onChange={(e) => { setComunidad(e.target.value); setEtapa(""); setArea(""); setNivel(""); }}>
                                <option value="">Selecciona</option>
                                {comunidades.map((c) => <option key={c.comunidad_key} value={c.comunidad_key}>{c.comunidad}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="lam-mono block mb-1">Etapa</span>
                            <select className="lam-input" value={etapa} disabled={!comunidad} onChange={(e) => { setEtapa(e.target.value); setArea(""); setNivel(""); }}>
                                <option value="">Selecciona</option>
                                {etapas.map((e) => <option key={e.etapa_key} value={e.etapa_key}>{e.etapa}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="lam-mono block mb-1">Área</span>
                            <select className="lam-input" value={area} disabled={!etapa} onChange={(e) => { setArea(e.target.value); setNivel(""); }}>
                                <option value="">Selecciona</option>
                                {areas.map((a) => <option key={a.area_key} value={a.area_key}>{a.area}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="lam-mono block mb-1">Nivel</span>
                            <select className="lam-input" value={nivel} disabled={!area} onChange={(e) => setNivel(e.target.value)}>
                                <option value="">Selecciona</option>
                                {niveles.map((n) => <option key={n.nivel_key} value={n.nivel_key}>{n.nivel}{n.revisar ? " (revisar)" : ""}</option>)}
                            </select>
                        </label>
                    </div>

                    {detalleLoading ? <p className="m-0 mt-3 lam-mono animate-pulse">Cargando matriz</p> : null}
                    {detalle ? (
                        <>
                            {renderList("criterios", detalle.criterios, showCriterios, setShowCriterios)}
                            {renderList("saberes", detalle.saberes, showSaberes, setShowSaberes)}
                            <div className="mt-3 flex justify-end">
                                <button type="button" onClick={clear} className="lam-mono underline underline-offset-4">
                                    Quitar matriz
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
