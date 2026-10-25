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

export default function SessionTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        tema: "",
        curso: "",
        descripcion: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateSession({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Diseño de Sesiones"
            description="Planifica una sesión didáctica detallada paso a paso."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">La sesión generada aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label">Tema o Contenido</label>
                    <input type="text" className="lam-input"
                        placeholder="Ej. Ecuaciones de primer grado, La Célula..."
                        value={formData.tema} onChange={e => setFormData({ ...formData, tema: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Curso y Grupo</label>
                    <select className="lam-input"
                        value={formData.curso} onChange={e => setFormData({ ...formData, curso: e.target.value })} required>
                        <option value="">Selecciona un curso</option>
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
                    <label className="lam-label">Enfoque Metodológico (Opcional)</label>
                    <textarea className="lam-input h-32 resize-none"
                        placeholder="Ej. Aprendizaje Cooperativo, Gamificación, Flipped Classroom..."
                        value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Sesión
                </button>
            </form>
        </GeneratorLayout>
    );
}
