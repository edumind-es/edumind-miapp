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
import { Loader2 } from "lucide-react";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

export default function DefenseTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
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
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">El resultado del análisis aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Modo</label>
                    <select className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        value={formData.modo} onChange={e => setFormData({ ...formData, modo: e.target.value })}>
                        <option value="modelo">Generar Respuesta Modelo</option>
                        <option value="evaluar">Evaluar mi Respuesta</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Especialidad</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej. Primaria Inglés"
                        value={formData.especialidad} onChange={e => setFormData({ ...formData, especialidad: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Enunciado del Supuesto / Pregunta</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-32 resize-none"
                        placeholder="Pega aquí el enunciado..."
                        value={formData.enunciado} onChange={e => setFormData({ ...formData, enunciado: e.target.value })} required />
                </div>

                {formData.modo === "evaluar" && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Tu Respuesta</label>
                        <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-48 resize-none"
                            placeholder="Escribe aquí tu defensa o respuesta..."
                            value={formData.respuesta_usuario} onChange={e => setFormData({ ...formData, respuesta_usuario: e.target.value })} required />
                    </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} {formData.modo === 'evaluar' ? 'Evaluar Respuesta' : 'Generar Modelo'}
                </button>
            </form>
        </GeneratorLayout>
    );
}
