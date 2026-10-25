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
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { getInitialEngine } from "@/lib/engine-preference";

export default function CaseTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        cuerpo: "Profesores de Secundaria",
        especialidad: "Geografía e Historia",
        numero_preguntas: "4",
        tiempo_respuesta: "120",
        incluir_nee: "Sí, incluir adaptaciones",
        incluir_normativa: "Sí, estatal y autonómica (Galicia)"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateCase({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Supuesto Práctico"
            description="Generador de supuestos prácticos para oposiciones docentes."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El supuesto generado aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="case-cuerpo-y-especialidad">Cuerpo y Especialidad</label>
                    <input id="case-cuerpo-y-especialidad" type="text" className="lam-input mb-2"
                        placeholder="Cuerpo" value={formData.cuerpo} onChange={e => setFormData({ ...formData, cuerpo: e.target.value })} />
                    <input type="text" className="lam-input"
                        placeholder="Especialidad" value={formData.especialidad} onChange={e => setFormData({ ...formData, especialidad: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="case-no-preguntas">Nº Preguntas</label>
                        <input id="case-no-preguntas" type="number" className="lam-input"
                            value={formData.numero_preguntas} onChange={e => setFormData({ ...formData, numero_preguntas: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="case-tiempo-min">Tiempo (min)</label>
                        <input id="case-tiempo-min" type="number" className="lam-input"
                            value={formData.tiempo_respuesta} onChange={e => setFormData({ ...formData, tiempo_respuesta: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <label className="flex items-center gap-2 text-ink cursor-pointer">
                        <input type="checkbox" checked={formData.incluir_nee.startsWith("Sí")}
                            onChange={e => setFormData({ ...formData, incluir_nee: e.target.checked ? "Sí, incluir adaptaciones" : "No" })} />
                        Incluir NEAE/Diversidad
                    </label>
                    <label className="flex items-center gap-2 text-ink cursor-pointer">
                        <input type="checkbox" checked={formData.incluir_normativa.startsWith("Sí")}
                            onChange={e => setFormData({ ...formData, incluir_normativa: e.target.checked ? "Sí, estatal y autonómica" : "No" })} />
                        Incluir Marco Normativo
                    </label>
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Supuesto
                </button>
            </form>
        </GeneratorLayout>
    );
}
