/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
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
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">Esperando generación...</span>}
                    {output && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={handleDownload} className="flex items-center gap-2 lam-btn lam-btn-sm">
                                    Descargar CSV
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap bg-paper-2 p-4 text-xs font-mono">{output}</pre>
                        </div>
                    )}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label">Título de la Rúbrica</label>
                    <input type="text" className="lam-input"
                        placeholder="Ej: Debate sobre Cambio Climático"
                        value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Área / Materia</label>
                        <input type="text" className="lam-input"
                            placeholder="Ej: Biología"
                            value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Nº Criterios</label>
                        <input type="number" className="lam-input"
                            min="1" max="15"
                            value={formData.criterios} onChange={e => setFormData({ ...formData, criterios: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Descripción del Proyecto/Tarea</label>
                    <textarea className="lam-input h-24 resize-none"
                        placeholder="Describe brevemente qué se evalúa..."
                        value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} required />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Rúbrica
                </button>
            </form>
        </GeneratorLayout>
    );
}
