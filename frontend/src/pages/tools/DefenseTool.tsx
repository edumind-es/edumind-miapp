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

export default function DefenseTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        modo: "modelo",
        especialidad: "",
        normativa: "Sí",
        enunciado: "",
        respuesta_usuario: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateDefense({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Defensa Oral y Solucionador"
            description="Obtén respuestas modelo para supuestos o evalúa tus propias defensas."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El resultado del análisis aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="defense-modo">Modo</label>
                    <select id="defense-modo" className="lam-input"
                        value={formData.modo} onChange={e => setFormData({ ...formData, modo: e.target.value })}>
                        <option value="modelo">Generar Respuesta Modelo</option>
                        <option value="evaluar">Evaluar mi Respuesta</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="defense-especialidad">Especialidad</label>
                    <input id="defense-especialidad" type="text" className="lam-input"
                        placeholder="Ej. Primaria Inglés"
                        value={formData.especialidad} onChange={e => setFormData({ ...formData, especialidad: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="defense-enunciado-del-supuesto-pregunta">Enunciado del Supuesto / Pregunta</label>
                    <textarea id="defense-enunciado-del-supuesto-pregunta" className="lam-input h-32 resize-none"
                        placeholder="Pega aquí el enunciado..."
                        value={formData.enunciado} onChange={e => setFormData({ ...formData, enunciado: e.target.value })} required />
                </div>

                {formData.modo === "evaluar" && (
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="defense-tu-respuesta">Tu Respuesta</label>
                        <textarea id="defense-tu-respuesta" className="lam-input h-48 resize-none"
                            placeholder="Escribe aquí tu defensa o respuesta..."
                            value={formData.respuesta_usuario} onChange={e => setFormData({ ...formData, respuesta_usuario: e.target.value })} required />
                    </div>
                )}

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} {formData.modo === 'evaluar' ? 'Evaluar Respuesta' : 'Generar Modelo'}
                </button>
            </form>
        </GeneratorLayout>
    );
}
