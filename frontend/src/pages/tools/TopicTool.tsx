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

export default function TopicTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        numero: "",
        titulo: "",
        cuerpo: "",
        especialidad: "",
        parte: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateTopic({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Desarrollo de Temas"
            description="Genera partes de un tema de oposición con rigor académico y estructura oficial."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">El desarrollo del tema aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nº Tema</label>
                        <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            placeholder="Ej. 14"
                            value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Cuerpo</label>
                        <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            placeholder="Ej. Secundaria"
                            value={formData.cuerpo} onChange={e => setFormData({ ...formData, cuerpo: e.target.value })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Título del Tema</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej. El desarrollo evolutivo..."
                        value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Especialidad</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej. Orientación Educativa, Matemáticas..."
                        value={formData.especialidad} onChange={e => setFormData({ ...formData, especialidad: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Parte a Desarrollar</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-32 resize-none"
                        placeholder="Ej. Introducción y Epígrafe 1..."
                        value={formData.parte} onChange={e => setFormData({ ...formData, parte: e.target.value })} required />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Desarrollar Tema
                </button>
            </form>
        </GeneratorLayout>
    );
}
