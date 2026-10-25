/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Formulario del perfil pedagógico: matriz preferida, curso, metodología, agrupamiento y
// una nota de contexto anonimizada. Lo que se guarda prellena las herramientas.

import { useEffect, useState } from "react";
import { CurriculumMatrixSelector } from "@/components/CurriculumMatrixSelector";
import { NoticeBanner } from "@/components/NoticeBanner";
import type { MatrizCurricularRef } from "@/lib/curriculum-service";
import { EMPTY_PROFILE, fetchTeacherProfile, saveTeacherProfile, type TeacherProfile } from "@/lib/profile-service";

const AGRUPAMIENTOS = ["Individual", "Parejas", "Grupos pequeños (3-5)", "Grupos grandes (6+)", "Gran grupo", "Agrupamiento flexible"];

export function TeacherProfileForm() {
    const [profile, setProfile] = useState<TeacherProfile>(EMPTY_PROFILE);
    const [matriz, setMatriz] = useState<MatrizCurricularRef | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ variant: "success" | "error"; message: string } | null>(null);

    useEffect(() => {
        let active = true;
        fetchTeacherProfile()
            .then((data) => {
                if (!active) return;
                if (data) {
                    setProfile(data);
                    if (data.matriz_id) setMatriz({ id: data.matriz_id });
                }
            })
            .catch(() => undefined)
            .finally(() => active && setLoaded(true));
        return () => {
            active = false;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const [comunidad_key, etapa_key, area_key] = matriz?.id ? matriz.id.split("/") : [null, null, null];
            const saved = await saveTeacherProfile({
                ...profile,
                matriz_id: matriz?.id ?? null,
                comunidad_key: comunidad_key ?? null,
                etapa_key: etapa_key ?? null,
                area_key: area_key ?? null,
                metodologia_slider: profile.metodologia_slider ?? null,
            });
            setProfile(saved);
            setNotice({ variant: "success", message: "Perfil guardado. Las herramientas lo usarán para prellenar curso y currículo." });
        } catch (error) {
            setNotice({ variant: "error", message: error instanceof Error ? error.message : "No se pudo guardar el perfil." });
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return <p className="m-0 lam-mono animate-pulse">Cargando perfil</p>;

    return (
        <div className="space-y-4">
            <p className="m-0 text-ink-2 text-[14px] leading-snug">
                Solo preferencias de trabajo: nada de datos personales ni del alumnado. Puedes dejarlo vacío.
            </p>
            {notice ? <NoticeBanner variant={notice.variant} message={notice.message} onClose={() => setNotice(null)} /> : null}

            <CurriculumMatrixSelector value={matriz} onChange={setMatriz} hint="Matriz curricular que usas habitualmente: quedará seleccionada en cada herramienta." />

            <label className="block">
                <span className="lam-mono block mb-1">Curso habitual</span>
                <input
                    className="lam-input w-full"
                    value={profile.curso ?? ""}
                    maxLength={60}
                    placeholder="Ej. 5.º de Primaria"
                    onChange={(e) => setProfile({ ...profile, curso: e.target.value || null })}
                />
            </label>

            <label className="block">
                <span className="lam-mono block mb-1">Agrupamiento habitual</span>
                <select
                    className="lam-input w-full"
                    value={profile.tipo_agrupamiento ?? ""}
                    onChange={(e) => setProfile({ ...profile, tipo_agrupamiento: e.target.value || null })}
                >
                    <option value="">Sin preferencia</option>
                    {AGRUPAMIENTOS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
            </label>

            <label className="block">
                <span className="lam-mono block mb-1">
                    Enfoque metodológico{" "}
                    <span className="text-ink-2">
                        ({profile.metodologia_slider === null ? "sin preferencia" : profile.metodologia_slider < 30 ? "tradicional" : profile.metodologia_slider < 70 ? "equilibrado" : "innovador"})
                    </span>
                </span>
                <input
                    type="range"
                    min={0}
                    max={100}
                    className="w-full"
                    value={profile.metodologia_slider ?? 50}
                    onChange={(e) => setProfile({ ...profile, metodologia_slider: Number(e.target.value) })}
                />
            </label>

            <label className="block">
                <span className="lam-mono block mb-1">Contexto del aula o centro (anonimizado)</span>
                <textarea
                    className="lam-input w-full h-20 resize-none"
                    maxLength={600}
                    placeholder="Ej. CEIP rural de línea 1, pabellón compartido, 22 alumnos por grupo."
                    value={profile.contexto_aula ?? ""}
                    onChange={(e) => setProfile({ ...profile, contexto_aula: e.target.value || null })}
                />
            </label>

            <button type="button" className="lam-btn lam-btn-sm" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Guardando…" : "Guardar perfil"}
            </button>
        </div>
    );
}
