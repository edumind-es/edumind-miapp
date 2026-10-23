/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { Loader2 } from "lucide-react";
import { EngineSelector } from "@/components/EngineSelector";
import { ContextualFields, type ContextualData } from "@/components/ContextualFields";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

export default function MethodologyTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        contenido: "",
        grupo: ""
    });

    const [contextualData, setContextualData] = useState<ContextualData>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateMethodology({
                ...formData,
                ...contextualData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Asesor Metodológico"
            description="Compara diferentes enfoques pedagógicos (Directivo, Guiado, Innovador) para un mismo contenido."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={80}
            serverModelType="quality"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">Esperando análisis...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Contenido a Enseñar</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: Las fracciones, El Siglo de Oro, Voleibol..."
                        value={formData.contenido} onChange={e => setFormData({ ...formData, contenido: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Grupo / Nivel</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: 2º ESO, Grupo heterogéneo"
                        value={formData.grupo} onChange={e => setFormData({ ...formData, grupo: e.target.value })} required />
                </div>

                <ContextualFields data={contextualData} onChange={setContextualData} />

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Analizar Metodologías
                </button>
            </form>
        </GeneratorLayout>
    );
}
