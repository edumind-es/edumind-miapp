/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";

import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import {
    normativeService,
    type NormativeResultItem,
    type NormativeSearchResponse,
} from "@/lib/normative-retrieval";

const PAGE_SIZE = 5;

function buildNormativePayload(engine: string, apiKey: string, consulta: string, contexto: string) {
    return {
        consulta,
        contexto,
        provider: engine,
        api_key: apiKey,
    };
}

export default function NormativaTool() {
    const {
        output,
        setOutput,
        loading,
        error,
        runGeneration,
        retryLast,
        cancelGeneration,
        clearError,
    } = useGeneratorRequest();

    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");
    const [query, setQuery] = useState("");

    const [sources, setSources] = useState<NormativeResultItem[]>([]);
    const [retrievedContext, setRetrievedContext] = useState("");
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalResults, setTotalResults] = useState(0);
    const [cacheHit, setCacheHit] = useState(false);

    const fetchNormativePage = async (targetPage: number): Promise<NormativeSearchResponse | null> => {
        if (!query.trim()) return null;
        setSearchLoading(true);
        setSearchError(null);

        try {
            const response = await normativeService.search(query.trim(), targetPage, PAGE_SIZE);
            setSources(response.results);
            setRetrievedContext(response.context);
            setPage(response.page);
            setTotalPages(response.total_pages);
            setTotalResults(response.total_results);
            setCacheHit(response.cache_hit);
            return response;
        } catch (err) {
            console.error(err);
            setSources([]);
            setRetrievedContext("");
            setSearchError("No se pudo recuperar normativa. Revisa conexión e inténtalo de nuevo.");
            return null;
        } finally {
            setSearchLoading(false);
        }
    };

    const runAnswerGeneration = async (contextText: string) => {
        await runGeneration((onChunk, options) =>
            generatorService.generateNormativa(
                buildNormativePayload(engine, apiKey, query.trim(), contextText),
                onChunk,
                options
            )
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        clearError();
        setOutput("");

        const response = await fetchNormativePage(1);
        if (!response) {
            setOutput("Error al recuperar normativa.");
            return;
        }
        if (response.total_results === 0 || !response.context.trim()) {
            setOutput("No encontré normativa relacionada con tu consulta. Intenta con otros términos.");
            return;
        }

        await runAnswerGeneration(response.context);
    };

    const handlePageChange = async (targetPage: number) => {
        if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
        await fetchNormativePage(targetPage);
    };

    const handleRegenerateWithCurrentPage = async () => {
        if (!retrievedContext.trim()) return;
        clearError();
        setOutput("");
        await runAnswerGeneration(retrievedContext);
    };

    const busy = loading || searchLoading;

    return (
        <GeneratorLayout
            title="Aplicación Normativa (Galicia)"
            description="Consulta normativa de convivencia indexada en backend: búsqueda rápida, paginada y optimizada para móvil."
            isServerLoading={loading && engine === "edumind"}
            serverEstimatedTime={20}
            serverModelType="quality"
            errorMessage={error}
            onRetry={retryLast}
            isLoading={busy}
            onCancel={cancelGeneration}
            preview={
                <div className="flex flex-col h-full">
                    {!output && !busy && (
                        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
                            Haz una consulta para recuperar normativa y generar una respuesta guiada.
                        </div>
                    )}

                    {searchLoading && (
                        <div className="mb-4 rounded border border-blue-500/30 bg-blue-950/20 p-3 text-xs text-blue-200 flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Recuperando normativa indexada...
                        </div>
                    )}

                    {searchError && (
                        <div className="mb-4 rounded border border-red-500/40 bg-red-950/20 p-3 text-xs text-red-200">
                            {searchError}
                        </div>
                    )}

                    {sources.length > 0 && !searchLoading && (
                        <div className="mb-4 rounded border border-blue-500/20 bg-blue-950/20 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-blue-100">
                                <strong className="inline-flex items-center gap-2">
                                    <BookOpen size={12} />
                                    Fuentes detectadas ({totalResults} resultados)
                                </strong>
                                <span className="text-[11px] opacity-80">{cacheHit ? "cache: hit" : "cache: miss"}</span>
                            </div>

                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {sources.map((item) => (
                                    <div key={`${item.document_id}-${item.section_label}-${item.score}`} className="rounded border border-white/10 bg-slate-900/40 p-2 text-xs text-slate-200">
                                        <div className="font-semibold text-blue-200">{item.title}</div>
                                        <div className="opacity-80 mt-1 line-clamp-3">{item.content}</div>
                                        <div className="mt-1 text-[11px] text-slate-400">Score: {item.score.toFixed(1)}</div>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-3 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={busy || page <= 1}
                                        className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40"
                                    >
                                        <ChevronLeft size={14} />
                                        Anterior
                                    </button>
                                    <span className="text-[11px] text-slate-300">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={busy || page >= totalPages}
                                        className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40"
                                    >
                                        Siguiente
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="prose prose-invert max-w-none flex-1">
                        {output && <div className="whitespace-pre-wrap">{output}</div>}
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector
                    currentEngine={engine}
                    onSelect={setEngine}
                    apiKey={apiKey}
                    onApiKeyChange={setApiKey}
                />

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Consulta sobre Convivencia</label>
                    <textarea
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-32 resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="Ej: ¿Cuáles son los pasos ante un caso de acoso escolar? ¿Qué medidas correctivas se aplican a faltas graves?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        required
                    />
                </div>

                <div className="bg-slate-800/50 p-3 rounded text-xs text-slate-400">
                    <p className="font-bold mb-1">Base indexada en backend:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Ley 4/2011 de Convivencia</li>
                        <li>Decreto 8/2015</li>
                        <li>Protocolos de Acoso, Maltrato, Absentismo, Identidad de Género...</li>
                        <li>Ley Orgánica 8/2021 (Rhodes)</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {busy ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                        Buscar y responder
                    </button>

                    <button
                        type="button"
                        onClick={handleRegenerateWithCurrentPage}
                        disabled={busy || !retrievedContext.trim()}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Regenerar con página actual
                    </button>
                </div>
            </form>
        </GeneratorLayout>
    );
}
