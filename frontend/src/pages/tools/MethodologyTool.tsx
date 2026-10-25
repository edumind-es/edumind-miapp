/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { EngineSelector } from "@/components/EngineSelector";
import { ContextualFields, type ContextualData } from "@/components/ContextualFields";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { getInitialEngine } from "@/lib/engine-preference";

export default function MethodologyTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
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
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">Esperando análisis...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="methodology-contenido-a-ensenar">Contenido a Enseñar</label>
                    <input id="methodology-contenido-a-ensenar" type="text" className="lam-input"
                        placeholder="Ej: Las fracciones, El Siglo de Oro, Voleibol..."
                        value={formData.contenido} onChange={e => setFormData({ ...formData, contenido: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="methodology-grupo-nivel">Grupo / Nivel</label>
                    <input id="methodology-grupo-nivel" type="text" className="lam-input"
                        placeholder="Ej: 2º ESO, Grupo heterogéneo"
                        value={formData.grupo} onChange={e => setFormData({ ...formData, grupo: e.target.value })} required />
                </div>

                <ContextualFields data={contextualData} onChange={setContextualData} />

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Analizar Metodologías
                </button>
            </form>
        </GeneratorLayout>
    );
}
