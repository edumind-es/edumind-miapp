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
import { getInitialEngine } from "@/lib/engine-preference";

export default function StemTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        producto: "",
        curso: "",
        materiales: "",
        neae: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateStem({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Proyectos STEM / Polos Creativos"
            description="Genera proyectos completos con fases de diseño, construcción y evaluación."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El proyecto generado aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label">Producto Final Deseado</label>
                    <input type="text" className="lam-input"
                        placeholder="Ej. Cohete de agua, Robot sigue-líneas..."
                        value={formData.producto} onChange={e => setFormData({ ...formData, producto: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Nivel o Curso</label>
                    <select className="lam-input"
                        value={formData.curso} onChange={e => setFormData({ ...formData, curso: e.target.value })} required>
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
                    <label className="lam-label">Materiales Disponibles</label>
                    <textarea className="lam-input h-24 resize-none"
                        placeholder="Ej. Cartón, motores DC, Arduino..."
                        value={formData.materiales} onChange={e => setFormData({ ...formData, materiales: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Casuísticas NEAE</label>
                    <textarea className="lam-input h-20 resize-none"
                        placeholder="Adaptaciones necesarias..."
                        value={formData.neae} onChange={e => setFormData({ ...formData, neae: e.target.value })} />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Proyecto STEM
                </button>
            </form>
        </GeneratorLayout>
    );
}
