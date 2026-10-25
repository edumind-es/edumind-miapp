/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useMemo, useState } from "react";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { exportService } from "@/lib/export-service";
import { parseRubric, rubricToCsv, rubricToPlainText } from "@/lib/rubric-format";
import { generatorService } from "@/lib/generator-service";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { getInitialEngine } from "@/lib/engine-preference";
import { CurriculumMatrixSelector } from "@/components/CurriculumMatrixSelector";
import type { MatrizCurricularRef } from "@/lib/curriculum-service";

export default function RubricsTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");
    const [matriz, setMatriz] = useState<MatrizCurricularRef | null>(null);

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
                matriz_curricular: matriz ?? undefined,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    // La salida es JSON con esquema: la tabla, el CSV y el Word se componen a partir de los datos.
    const rubric = useMemo(() => (loading ? null : parseRubric(output)), [output, loading]);
    const baseFilename = `rubrica_${(formData.nombre || "sin_titulo").trim().replace(/\s+/g, "_")}`;

    const handleDownloadCsv = () => {
        if (!rubric) return;
        const blob = new Blob([rubricToCsv(rubric)], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseFilename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadDocx = async () => {
        if (!rubric) return;
        try {
            await exportService.toDocx({ content: rubricToPlainText(rubric), filename: baseFilename, title: rubric.titulo });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <GeneratorLayout
            title="Generador de Rúbricas"
            description="Rúbricas de cuatro niveles con descriptores observables, ligadas al currículo oficial y exportables a CSV (iDoceo/Additio) y Word."
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
                    {output && rubric && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="m-0 text-[20px] font-bold">{rubric.titulo}</h2>
                                    {rubric.area ? <p className="m-0 text-ink-2 text-[13px]">{rubric.area}</p> : null}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleDownloadCsv} className="lam-btn lam-btn-sm">
                                        CSV iDoceo/Additio
                                    </button>
                                    <button type="button" onClick={() => void handleDownloadDocx()} className="lam-btn lam-btn-sm lam-btn-ghost">
                                        Word
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[13px]">
                                    <thead>
                                        <tr className="border-b-2 border-ink text-left">
                                            <th className="py-2 pr-3 align-bottom">Criterio</th>
                                            {rubric.niveles.map((nivel) => (
                                                <th key={nivel} className="py-2 px-3 align-bottom lam-mono">{nivel}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rubric.criterios.map((c, index) => (
                                            <tr key={`${c.criterio}-${index}`} className="border-b border-hair align-top">
                                                <td className="py-2 pr-3 font-semibold">
                                                    {c.criterio}
                                                    {c.codigo_curricular ? <span className="block lam-mono text-ink-2">{c.codigo_curricular}</span> : null}
                                                    {c.peso !== undefined ? <span className="block text-ink-2 font-normal">{c.peso} %</span> : null}
                                                </td>
                                                {rubric.niveles.map((nivel, i) => (
                                                    <td key={nivel} className="py-2 px-3 text-ink-2">{c.descriptores[i] ?? ""}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {rubric.observaciones ? <p className="m-0 text-[13px] text-ink-2">{rubric.observaciones}</p> : null}
                        </div>
                    )}
                    {output && !rubric && !loading && (
                        <pre className="whitespace-pre-wrap bg-paper-2 p-4 text-xs font-mono">{output}</pre>
                    )}
                    {output && loading && <span className="lam-mono animate-pulse">Generando rúbrica</span>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <CurriculumMatrixSelector value={matriz} onChange={setMatriz} />

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="rubrics-titulo-de-la-rubrica">Título de la Rúbrica</label>
                    <input id="rubrics-titulo-de-la-rubrica" type="text" className="lam-input"
                        placeholder="Ej: Debate sobre Cambio Climático"
                        value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="rubrics-area-materia">Área / Materia</label>
                        <input id="rubrics-area-materia" type="text" className="lam-input"
                            placeholder="Ej: Biología"
                            value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="rubrics-no-criterios">Nº Criterios</label>
                        <input id="rubrics-no-criterios" type="number" className="lam-input"
                            min="1" max="15"
                            value={formData.criterios} onChange={e => setFormData({ ...formData, criterios: parseInt(e.target.value) })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="rubrics-descripcion-del-proyecto-tarea">Descripción del Proyecto/Tarea</label>
                    <textarea id="rubrics-descripcion-del-proyecto-tarea" className="lam-input h-24 resize-none"
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
