/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { Loader2, Copy, Check } from "lucide-react";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";

export default function QuestionTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");
    const [copied, setCopied] = useState(false);

    const [formData, setFormData] = useState({
        texto_fuente: "",
        tipo_pregunta: "multiple_choice",
        cantidad: 5,
        dificultad: "Media"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateQuestions({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <GeneratorLayout
            title="Generador de Preguntas (GIFT)"
            description="Crea baterías de preguntas compatibles con Moodle (GIFT) listas para importar."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={30}
            serverModelType="fast"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading && <span className="text-slate-500">Esperando preguntas...</span>}
                    {output && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={handleCopy} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm transition-colors">
                                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                    {copied ? "Copiado" : "Copiar GIFT"}
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap bg-black/30 p-4 rounded text-xs font-mono border-l-4 border-green-500">{output}</pre>
                            <p className="text-xs text-slate-400 italic">Copia este texto y guárdalo como archivo .txt para importarlo en Moodle (Formato GIFT).</p>
                        </div>
                    )}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Texto Fuente / Tema</label>
                    <textarea className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-32 resize-none"
                        placeholder="Pega aquí el texto sobre el que quieres generar preguntas..."
                        value={formData.texto_fuente} onChange={e => setFormData({ ...formData, texto_fuente: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Tipo de Pregunta</label>
                        <select className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            value={formData.tipo_pregunta} onChange={e => setFormData({ ...formData, tipo_pregunta: e.target.value })}>
                            <option value="multiple_choice">Opción Múltiple</option>
                            <option value="true_false">Verdadero / Falso</option>
                            <option value="matching">Relacionar (Matching)</option>
                            <option value="short_answer">Respuesta Corta</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Dificultad</label>
                        <select className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            value={formData.dificultad} onChange={e => setFormData({ ...formData, dificultad: e.target.value })}>
                            <option value="Fácil">Fácil (Identificación)</option>
                            <option value="Media">Media (Comprensión)</option>
                            <option value="Alta">Alta (Análisis/Aplicación)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Cantidad</label>
                    <input type="number" className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        min="1" max="20"
                        value={formData.cantidad} onChange={e => setFormData({ ...formData, cantidad: parseInt(e.target.value) })} required />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {loading && <Loader2 className="animate-spin" />} Generar GIFT
                </button>
            </form>
        </GeneratorLayout>
    );
}
