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

import { useState, useMemo } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

// Data from legacy documentos.html
const DOCUMENT_TYPES = {
    diversidad: "Plan de Atención a la Diversidad",
    convivencia: "Plan de Convivencia",
    igualdad: "Plan de Igualdad",
    transicion: "Plan de Transición entre Etapas",
    biblioteca: "Plan de Biblioteca Escolar",
    digital: "Plan Digital de Centro",
    emergencia: "Plan de Emergencia y Autoprotección",
    formacion: "Plan de Formación del Profesorado",
    lectura: "Plan de Fomento de la Lectura",
    habitos: "Plan de Hábitos Saludables"
};

const SECTIONS = {
    diversidad: ["Justificación", "Identificación de necesidades", "Objetivos", "Medidas/Organizativos", "Recursos", "Protocolos", "Evaluación"],
    convivencia: ["Diagnóstico", "Objetivos", "Medidas preventivas", "Protocolo acoso", "Normas", "Comisión convivencia", "Evaluación"],
    igualdad: ["Diagnóstico", "Objetivos", "Medidas organizativas", "Formación profesorado", "Participación alumnado", "Seguimiento"],
    transicion: ["Justificación y objetivos", "Coordinación etapas", "Implicación familias", "Evaluación proceso"],
    biblioteca: ["Diagnóstico", "Objetivos", "Dinamización", "Gestión y recursos", "Evaluación"],
    digital: ["Diagnóstico competencia", "Objetivos", "Formación/Infraestructura", "Coordinación", "Evaluación impacto"],
    emergencia: ["Diagnóstico riesgos", "Objetivos", "Equipos actuación", "Protocolos evacuación", "Simulacros"],
    formacion: ["Análisis necesidades", "Objetivos", "Actividades formativas", "Criterios participación", "Revisión anual"],
    lectura: ["Diagnóstico hábitos", "Objetivos", "Actuaciones fomento", "Integración curricular", "Evaluación"],
    habitos: ["Justificación", "Objetivos", "Actividades", "Implicación profesorado", "Seguimiento"]
};

export default function InstitutionDocTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        tipo: "diversidad",
        seccion: "",
        contexto: "",
        fortalezas: "",
        debilidades: "",
        oportunidades: "",
        amenazas: ""
    });

    // Automatically select first section when type changes
    const availableSections = useMemo(() => SECTIONS[formData.tipo as keyof typeof SECTIONS] || [], [formData.tipo]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Ensure section is set if empty
        const sectionToUse = formData.seccion || availableSections[0];

        await runGeneration((onChunk, options) =>
            generatorService.generateInstitutionDoc({
                ...formData,
                seccion: sectionToUse,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Documentación Institucional"
            description="Genera partes de documentos oficiales (PGA, RRI, Planes) adaptados al contexto."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El documento generado aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Documento</label>
                        <select className="lam-input"
                            value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value, seccion: "" })}>
                            {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Sección a Generar</label>
                        <select className="lam-input"
                            value={formData.seccion || availableSections[0]} onChange={e => setFormData({ ...formData, seccion: e.target.value })}>
                            {availableSections.map(sec => (
                                <option key={sec} value={sec}>{sec}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Contexto del Centro</label>
                    <textarea className="lam-input h-24 resize-none"
                        placeholder="Características, entorno, tipología de alumnado..."
                        value={formData.contexto} onChange={e => setFormData({ ...formData, contexto: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Análisis DAFO (Resumen)</label>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" className="lam-input !px-2 !py-1 text-sm"
                            placeholder="Fortalezas" value={formData.fortalezas} onChange={e => setFormData({ ...formData, fortalezas: e.target.value })} />
                        <input type="text" className="lam-input !px-2 !py-1 text-sm"
                            placeholder="Debilidades" value={formData.debilidades} onChange={e => setFormData({ ...formData, debilidades: e.target.value })} />
                        <input type="text" className="lam-input !px-2 !py-1 text-sm"
                            placeholder="Oportunidades" value={formData.oportunidades} onChange={e => setFormData({ ...formData, oportunidades: e.target.value })} />
                        <input type="text" className="lam-input !px-2 !py-1 text-sm"
                            placeholder="Amenazas" value={formData.amenazas} onChange={e => setFormData({ ...formData, amenazas: e.target.value })} />
                    </div>
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Sección
                </button>
            </form>
        </GeneratorLayout>
    );
}
