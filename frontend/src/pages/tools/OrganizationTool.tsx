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

export default function OrganizationTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        metodologia: "",
        espacio: "",
        recursos: "",
        casuistica: ""
    });

    const [contextualData, setContextualData] = useState<ContextualData>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateOrganization({
                ...formData,
                ...contextualData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Organización de Espacios"
            description="Diseña la distribución del aula para maximizar el aprendizaje y la inclusión (DUA)."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={60}
            serverModelType="quality"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">Esperando diseño...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Enfoque Metodológico</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: Trabajo por Rincones, Aprendizaje Cooperativo..."
                        value={formData.metodologia} onChange={e => setFormData({ ...formData, metodologia: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Características del Espacio</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: Aula pequeña, luz natural, mesas móviles..."
                        value={formData.espacio} onChange={e => setFormData({ ...formData, espacio: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Recursos Disponibles</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-20 resize-none"
                        placeholder="PDI, Tablets, Material manipulativo..."
                        value={formData.recursos} onChange={e => setFormData({ ...formData, recursos: e.target.value })} />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Casuística Alumnado (DUA)</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-20 resize-none"
                        placeholder="Alumnado con movilidad reducida, TDAH..."
                        value={formData.casuistica} onChange={e => setFormData({ ...formData, casuistica: e.target.value })} />
                </div>

                <ContextualFields data={contextualData} onChange={setContextualData} />

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Generar Distribución
                </button>
            </form>
        </GeneratorLayout>
    );
}
