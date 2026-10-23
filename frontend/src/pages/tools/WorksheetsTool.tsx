/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { Loader2, Printer } from "lucide-react";
import { EngineSelector } from "@/components/EngineSelector";
import { ContextualFields, type ContextualData } from "@/components/ContextualFields";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { cleanGeneratedText } from "@/lib/content-format";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export default function WorksheetsTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        tema: "",
        objetivo: "",
        tipo: "Ficha de repaso",
        edad: "10-12 años"
    });

    const [contextualData, setContextualData] = useState<ContextualData>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateWorksheets({
                ...formData,
                ...contextualData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    const handlePrint = () => {
        const printableOutput = escapeHtml(cleanGeneratedText(output));
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Ficha Didáctica - ${formData.tema}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                        h1 { color: #333; text-align: center; }
                        h2 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 20px; }
                        .content { white-space: pre-wrap; }
                    </style>
                </head>
                <body>
                    <div class="content">${printableOutput}</div>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    };

    return (
        <GeneratorLayout
            title="Generador de Fichas"
            description="Crea material didáctico imprimible, fichas de repaso y cuestionarios."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={45}
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
                                <button onClick={handlePrint} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors">
                                    <Printer size={16} /> Imprimir / PDF
                                </button>
                            </div>
                            <div className="whitespace-pre-wrap">{output}</div>
                        </div>
                    )}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Tema Principal</label>
                    <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        placeholder="Ej: El Ciclo del Agua"
                        value={formData.tema} onChange={e => setFormData({ ...formData, tema: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Tipo de Recurso</label>
                        <select className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
                            <option>Ficha de repaso</option>
                            <option>Ficha de ampliación</option>
                            <option>Examen tipo test</option>
                            <option>Lectura comprensiva</option>
                            <option>Mapa conceptual hueco</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Edad / Nivel</label>
                        <input type="text" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            placeholder="Ej: 3º Primaria (8-9 años)"
                            value={formData.edad} onChange={e => setFormData({ ...formData, edad: e.target.value })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Objetivo de Aprendizaje</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="¿Qué deben aprender o practicar?"
                        value={formData.objetivo} onChange={e => setFormData({ ...formData, objetivo: e.target.value })} required />
                </div>

                <ContextualFields data={contextualData} onChange={setContextualData} />

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Generar Ficha
                </button>
            </form>
        </GeneratorLayout>
    );
}
