/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useState } from "react";

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
                        <div className="flex-1 flex items-center justify-center text-ink-3 text-sm">
                            Haz una consulta para recuperar normativa y generar una respuesta guiada.
                        </div>
                    )}

                    {searchLoading && (
                        <div className="lam-note mental mb-4">
                            <span className="tag">Búsqueda</span>
                            <p className="m-0 text-sm">Recuperando normativa indexada...</p>
                        </div>
                    )}

                    {searchError && (
                        <div className="lam-note alert mb-4">
                            <span className="tag">Error</span>
                            <p className="m-0 text-sm">{searchError}</p>
                        </div>
                    )}

                    {sources.length > 0 && !searchLoading && (
                        <div className="lam-panel mb-4">
                            <div className="lam-panel-head">
                                <span className="lam-mono lam-mono-ink">Fuentes detectadas · {totalResults} resultados</span>
                                <span className="lam-mono">{cacheHit ? "caché: hit" : "caché: miss"}</span>
                            </div>

                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                {sources.map((item) => (
                                    <div key={`${item.document_id}-${item.section_label}-${item.score}`} className="border border-hair bg-paper/40 p-2 text-xs text-ink">
                                        <div className="font-semibold">{item.title}</div>
                                        <div className="opacity-80 mt-1 line-clamp-3">{item.content}</div>
                                        <div className="mt-1 lam-mono">Score {item.score.toFixed(1)}</div>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-3 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={busy || page <= 1}
                                        className="lam-btn lam-btn-sm lam-btn-ghost"
                                    >
                                        ← Anterior
                                    </button>
                                    <span className="lam-mono">Página {page} de {totalPages}</span>
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={busy || page >= totalPages}
                                        className="lam-btn lam-btn-sm lam-btn-ghost"
                                    >
                                        Siguiente →
                                                                            </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="lam-prose flex-1">
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
                    <label className="lam-label">Consulta sobre Convivencia</label>
                    <textarea
                        className="lam-input h-32 resize-none"
                        placeholder="Ej: ¿Cuáles son los pasos ante un caso de acoso escolar? ¿Qué medidas correctivas se aplican a faltas graves?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <p className="lam-mono mb-1">Base indexada en backend</p>
                    <ul className="lam-rules text-sm">
                        <li><span className="dash">—</span>Ley 4/2011 de Convivencia</li>
                        <li><span className="dash">—</span>Decreto 8/2015</li>
                        <li><span className="dash">—</span>Protocolos de Acoso, Maltrato, Absentismo, Identidad de Género...</li>
                        <li><span className="dash">—</span>Ley Orgánica 8/2021 (Rhodes)</li>
                    </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        type="submit"
                        disabled={busy}
                        className="lam-btn lam-btn-block"
                    >
                        {busy ? <span className="font-mono" aria-hidden="true">···</span> : null}
                        Buscar y responder
                    </button>

                    <button
                        type="button"
                        onClick={handleRegenerateWithCurrentPage}
                        disabled={busy || !retrievedContext.trim()}
                        className="lam-btn lam-btn-block lam-btn-ghost"
                    >
                        Regenerar con página actual
                    </button>
                </div>
            </form>
        </GeneratorLayout>
    );
}
