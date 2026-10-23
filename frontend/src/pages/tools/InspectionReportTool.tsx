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

import { useState } from "react";

import { EngineSelector } from "@/components/EngineSelector";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { generatorService } from "@/lib/generator-service";

const DOCUMENT_TYPES = [
    { value: "informe_tecnico", label: "Informe Técnico" },
    { value: "acta_seguimiento", label: "Acta de Seguimiento" },
    { value: "respuesta_requerimiento", label: "Respuesta a Requerimiento" },
    { value: "plan_actuacion", label: "Plan de Actuación" },
];

const SUBTEMPLATES = [
    { value: "informe_tecnico", label: "Subplantilla: Informe Técnico" },
    { value: "acta_seguimiento", label: "Subplantilla: Acta de Seguimiento" },
    { value: "respuesta_requerimiento", label: "Subplantilla: Respuesta a Requerimiento" },
    { value: "plan_actuacion", label: "Subplantilla: Plan de Actuación" },
    { value: "alegaciones", label: "Subplantilla: Alegaciones" },
    { value: "informe_cierre", label: "Subplantilla: Informe de Cierre" },
];

const AMBITOS = [
    "Convivencia",
    "Atención a la diversidad",
    "Evaluación y promoción",
    "Organización y funcionamiento",
    "Absentismo y seguimiento",
    "Digitalización y protección de datos",
];

export default function InspectionReportTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        tipo_documento: "informe_tecnico",
        subplantilla: "informe_tecnico",
        ambito: "Convivencia",
        demanda_inspeccion: "",
        hallazgos: "",
        actuaciones_previas: "",
        evidencias: "",
        plazo_respuesta: "10 días hábiles",
        normativa_aplicable: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateInspectionReport(
                {
                    ...formData,
                    provider: engine,
                    api_key: apiKey,
                },
                onChunk,
                options
            )
        );
    };

    return (
        <GeneratorLayout
            title="Inspección Educativa"
            description="Elabora informes, actas de seguimiento y respuestas a requerimientos de inspección con enfoque técnico-operativo."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading ? (
                        <span className="text-ink-3">
                            El documento técnico para inspección aparecerá aquí...
                        </span>
                    ) : null}
                    {output ? <div className="whitespace-pre-wrap">{output}</div> : null}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Tipo de Documento</label>
                        <select
                            value={formData.tipo_documento}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    tipo_documento: e.target.value,
                                    subplantilla:
                                        prev.subplantilla === prev.tipo_documento
                                            ? e.target.value
                                            : prev.subplantilla,
                                }))
                            }
                            className="lam-input"
                        >
                            {DOCUMENT_TYPES.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="lam-label">Subplantilla Operativa</label>
                        <select
                            value={formData.subplantilla}
                            onChange={(e) => setFormData((prev) => ({ ...prev, subplantilla: e.target.value }))}
                            className="lam-input"
                        >
                            {SUBTEMPLATES.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="lam-label">Ámbito de la Demanda</label>
                        <select
                            value={formData.ambito}
                            onChange={(e) => setFormData((prev) => ({ ...prev, ambito: e.target.value }))}
                            className="lam-input"
                        >
                            {AMBITOS.map((ambito) => (
                                <option key={ambito} value={ambito}>
                                    {ambito}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Demanda de Inspección</label>
                    <textarea
                        required
                        value={formData.demanda_inspeccion}
                        onChange={(e) => setFormData((prev) => ({ ...prev, demanda_inspeccion: e.target.value }))}
                        className="lam-input h-24 resize-none"
                        placeholder="Describe qué solicita inspección, alcance y criterios esperados."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Hallazgos / Situación Actual del Centro</label>
                    <textarea
                        required
                        value={formData.hallazgos}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hallazgos: e.target.value }))}
                        className="lam-input h-24 resize-none"
                        placeholder="Describe hechos, incidencias, puntos fuertes y brechas detectadas."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Actuaciones Previas</label>
                    <textarea
                        value={formData.actuaciones_previas}
                        onChange={(e) => setFormData((prev) => ({ ...prev, actuaciones_previas: e.target.value }))}
                        className="lam-input h-20 resize-none"
                        placeholder="Medidas ya aplicadas, comisiones convocadas, reuniones, protocolos activados..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Evidencias Disponibles</label>
                    <textarea
                        required
                        value={formData.evidencias}
                        onChange={(e) => setFormData((prev) => ({ ...prev, evidencias: e.target.value }))}
                        className="lam-input h-20 resize-none"
                        placeholder="Actas, registros, anexos, indicadores, comunicaciones con familias..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Plazo de Respuesta</label>
                        <input
                            value={formData.plazo_respuesta}
                            onChange={(e) => setFormData((prev) => ({ ...prev, plazo_respuesta: e.target.value }))}
                            className="lam-input"
                            placeholder="Ej: 10 días hábiles"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Normativa Aplicable</label>
                        <input
                            value={formData.normativa_aplicable}
                            onChange={(e) => setFormData((prev) => ({ ...prev, normativa_aplicable: e.target.value }))}
                            className="lam-input"
                            placeholder="Ej: Ley 4/2011, Decreto 8/2015, instrucciones autonómicas..."
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="lam-btn lam-btn-block"
                >
                    {loading ? <span className="font-mono" aria-hidden="true">···</span> : null}
                    Generar Documento para Inspección
                </button>
            </form>
        </GeneratorLayout>
    );
}
