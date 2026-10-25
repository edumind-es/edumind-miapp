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

export default function DiversityTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        caso: "",
        intervencion_actual: "",
        resultados: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateDiversity({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Plan de Inclusión / Diversidad"
            description="Genera propuestas de intervención educativa para casos de diversidad (NEAE, NEE)."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">La propuesta de intervención aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="diversity-descripcion-del-caso">Descripción del Caso</label>
                    <textarea id="diversity-descripcion-del-caso" className="lam-input h-32 resize-none"
                        placeholder="Describe la situación sin datos identificativos: curso, barreras observadas, NEAE, contexto del grupo..."
                        value={formData.caso} onChange={e => setFormData({ ...formData, caso: e.target.value })} required />
                    <p className="m-0 text-[12px] text-ink-2 leading-snug">
                        Privacidad: no escribas nombres, iniciales reconocibles, centro ni fechas de nacimiento. Habla de
                        &quot;el alumno&quot; o &quot;el grupo&quot;. Correos, teléfonos y DNI se eliminan automáticamente antes de
                        enviar el texto al motor.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="diversity-intervencion-realizada-opcional">Intervención Realizada (Opcional)</label>
                    <textarea id="diversity-intervencion-realizada-opcional" className="lam-input h-24 resize-none"
                        placeholder="¿Qué se ha hecho hasta ahora?"
                        value={formData.intervencion_actual} onChange={e => setFormData({ ...formData, intervencion_actual: e.target.value })} />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="diversity-resultados-obtenidos-opcional">Resultados Obtenidos (Opcional)</label>
                    <textarea id="diversity-resultados-obtenidos-opcional" className="lam-input h-24 resize-none"
                        placeholder="¿Qué ha funcionado y qué no?"
                        value={formData.resultados} onChange={e => setFormData({ ...formData, resultados: e.target.value })} />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Intervención
                </button>
            </form>
        </GeneratorLayout>
    );
}
