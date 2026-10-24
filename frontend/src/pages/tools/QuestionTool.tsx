/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
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
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">Esperando preguntas...</span>}
                    {output && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button onClick={handleCopy} className="lam-btn lam-btn-sm lam-btn-ghost">
                                                                        {copied ? "Copiado" : "Copiar GIFT"}
                                </button>
                            </div>
                            <pre className="whitespace-pre-wrap bg-paper-2 p-4 text-xs font-mono border-l-[3px] border-ok">{output}</pre>
                            <p className="lam-mono normal-case tracking-normal">Copia este texto y guárdalo como archivo .txt para importarlo en Moodle (Formato GIFT).</p>
                        </div>
                    )}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="space-y-2">
                    <label className="lam-label">Texto Fuente / Tema</label>
                    <textarea className="lam-input h-32 resize-none"
                        placeholder="Pega aquí el texto sobre el que quieres generar preguntas..."
                        value={formData.texto_fuente} onChange={e => setFormData({ ...formData, texto_fuente: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Tipo de Pregunta</label>
                        <select className="lam-input"
                            value={formData.tipo_pregunta} onChange={e => setFormData({ ...formData, tipo_pregunta: e.target.value })}>
                            <option value="multiple_choice">Opción Múltiple</option>
                            <option value="true_false">Verdadero / Falso</option>
                            <option value="matching">Relacionar (Matching)</option>
                            <option value="short_answer">Respuesta Corta</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Dificultad</label>
                        <select className="lam-input"
                            value={formData.dificultad} onChange={e => setFormData({ ...formData, dificultad: e.target.value })}>
                            <option value="Fácil">Fácil (Identificación)</option>
                            <option value="Media">Media (Comprensión)</option>
                            <option value="Alta">Alta (Análisis/Aplicación)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Cantidad</label>
                    <input type="number" className="lam-input"
                        min="1" max="20"
                        value={formData.cantidad} onChange={e => setFormData({ ...formData, cantidad: parseInt(e.target.value) })} required />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar GIFT
                </button>
            </form>
        </GeneratorLayout>
    );
}
