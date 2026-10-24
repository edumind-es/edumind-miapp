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
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { EngineSelector } from "@/components/EngineSelector";
import { EDUCATION_LEVELS } from "@/lib/education-levels";
import { ContextualFields, type ContextualData } from "@/components/ContextualFields";
import { PedagogicalModelSelector } from "@/components/PedagogicalModelSelector";
import { NEAEDetailedSelector } from "@/components/NEAESelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { getModelDisplayName } from "@/lib/pedagogical-models";
import { formatNEAEForPrompt, type NEAECase } from "@/lib/neae";

export default function SituationTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        curso: "3º ESO",
        etapa_educativa: "ESO",
        modelo_pedagogico: "constructivista",
        modelo_pedagogico_custom: "",
        tipo_tarea: "Proyecto de investigación",
        estilo_ensenanza: "Delegador",
        contenidos: "",
        objetivos: "",
        criterios_evaluacion: "",
        temporalizacion: "3",
        tipo_temporalizacion: "semanas"
    });

    const [neaeCases, setNeaeCases] = useState<NEAECase[]>([]);
    const [contextualData, setContextualData] = useState<ContextualData>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateSituation({
                ...formData,
                modelo_pedagogico: getModelDisplayName(formData.modelo_pedagogico, formData.modelo_pedagogico_custom),
                casos_neae: formatNEAEForPrompt(neaeCases),
                ...contextualData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Situación de Aprendizaje"
            description="Diseña situaciones de aprendizaje completas adaptadas a la LOMLOE."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={120}
            serverModelType="quality"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">Esperando generación...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Tempo. (Número)</label>
                        <input type="number" className="lam-input"
                            placeholder="Ej: 3"
                            value={formData.temporalizacion} onChange={e => setFormData({ ...formData, temporalizacion: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Unidad</label>
                        <select className="lam-input"
                            value={formData.tipo_temporalizacion} onChange={e => setFormData({ ...formData, tipo_temporalizacion: e.target.value })}>
                            <option value="sesiones">Sesiones</option>
                            <option value="semanas">Semanas</option>
                            <option value="trimestres">Trimestres</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Curso</label>
                        <select className="lam-input"
                            value={formData.curso} onChange={e => setFormData({ ...formData, curso: e.target.value })}>
                            {EDUCATION_LEVELS.map((level) => (
                                <optgroup key={level.stage} label={level.stage}>
                                    {level.courses.map((course) => (
                                        <option key={course} value={course}>{course}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Etapa</label>
                        <select className="lam-input"
                            value={formData.etapa_educativa} onChange={e => setFormData({ ...formData, etapa_educativa: e.target.value })}>
                            {EDUCATION_LEVELS.map((level) => (
                                <option key={level.stage} value={level.stage}>{level.stage}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <PedagogicalModelSelector
                    value={formData.modelo_pedagogico}
                    customValue={formData.modelo_pedagogico_custom}
                    onChange={(model, custom) => setFormData({
                        ...formData,
                        modelo_pedagogico: model,
                        modelo_pedagogico_custom: custom || ""
                    })}
                />

                <div className="space-y-2">
                    <label className="lam-label">Objetivos y Contenidos Clave</label>
                    <textarea className="lam-input h-24 resize-none"
                        placeholder="Describe brevemente los objetivos..."
                        value={formData.objetivos} onChange={e => setFormData({ ...formData, objetivos: e.target.value })} required />
                </div>

                <NEAEDetailedSelector
                    cases={neaeCases}
                    onChange={setNeaeCases}
                />

                {/* Contextual Fields */}
                <ContextualFields data={contextualData} onChange={setContextualData} />

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Situación
                </button>
            </form>
        </GeneratorLayout>
    );
}
