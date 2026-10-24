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
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

export default function PlanningTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        curso: "3º ESO",
        horas: 3,
        objetivo: "",
        metodologia_tipo: "Intermedia",
        metodologia_texto: "Individual"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generatePlanning({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Planificación Didáctica"
            description="Genera unidades didácticas y programaciones completas."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && (
                        <div className="flex flex-col items-center justify-center h-full text-ink-3 min-h-[400px]">
                            <p>El contenido generado aparecerá aquí.</p>
                        </div>
                    )}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label">Curso</label>
                    <select
                        className="lam-input"
                        value={formData.curso}
                        onChange={e => setFormData({ ...formData, curso: e.target.value })}
                    >
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
                    <label className="lam-label">Horas Semanales ({formData.horas})</label>
                    <input
                        type="range"
                        min="1" max="10"
                        value={formData.horas}
                        onChange={e => setFormData({ ...formData, horas: parseInt(e.target.value) })}
                        className="w-full accent-ink"
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Objetivo Principal</label>
                    <textarea
                        className="lam-input h-32 resize-none"
                        placeholder="Ej: Conocer los fundamentos del voleibol..."
                        value={formData.objetivo}
                        onChange={e => setFormData({ ...formData, objetivo: e.target.value })}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-ink hover:bg-ink text-paper font-bold py-3 transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <span className="font-mono" aria-hidden="true">···</span>}
                    {loading ? "Generando..." : "Generar Planificación"}
                </button>
            </form>
        </GeneratorLayout>
    );
}
