/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { Loader2, Download } from "lucide-react";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

export default function RubricsTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        nombre: "",
        area: "",
        descripcion: "",
        criterios: 5
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateRubrics({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    const handleDownload = () => {
        const blob = new Blob([output], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubrica_${formData.nombre.replace(/\s+/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <GeneratorLayout
            title="Generador de Rúbricas"
            description="Crea rúbricas de evaluación precisas y expórtalas a CSV para iDoceo/Additio."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={60}
            serverModelType="fast"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">Esperando generación...</span>}
                    {output && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={handleDownload} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors">
                                    <Download size={16} /> Descargar CSV
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap bg-black/30 p-4 rounded text-xs font-mono">{output}</pre>
                        </div>
                    )}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Título de la Rúbrica</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: Debate sobre Cambio Climático"
                        value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Área / Materia</label>
                        <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            placeholder="Ej: Biología"
                            value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nº Criterios</label>
                        <input type="number" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            min="1" max="15"
                            value={formData.criterios} onChange={e => setFormData({ ...formData, criterios: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Descripción del Proyecto/Tarea</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="Describe brevemente qué se evalúa..."
                        value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} required />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Generar Rúbrica
                </button>
            </form>
        </GeneratorLayout>
    );
}
