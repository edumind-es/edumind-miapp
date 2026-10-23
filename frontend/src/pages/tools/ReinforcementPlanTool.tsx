/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import {
    normativeService,
    type CurriculumAreaItem,
} from "@/lib/normative-retrieval";

const PRIMARY_COURSES = [
    "1o Primaria",
    "2o Primaria",
    "3o Primaria",
    "4o Primaria",
    "5o Primaria",
    "6o Primaria",
];

function splitManualContents(raw: string): string[] {
    return raw
        .split(/\n|;|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function ReinforcementPlanTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState("edumind");
    const [apiKey, setApiKey] = useState("");

    const [curriculumAreas, setCurriculumAreas] = useState<CurriculumAreaItem[]>([]);
    const [curriculumLoading, setCurriculumLoading] = useState(true);
    const [curriculumError, setCurriculumError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        area_educativa: "",
        curso: "3o Primaria",
        etapa_educativa: "Educacion Primaria",
        fecha_inicio_refuerzo: "",
        fecha_fin_estimada: "",
        criterios_evaluacion: "",
        instrumentos_evaluacion: "",
        evidencias_necesidad_refuerzo: "",
        forma_trabajo_aplicada: "",
        recursos_empleados: "",
        desarrollo_aplicado: "",
        contenidos_manual: "",
        normativa_aplicable:
            "Orden del 8 de septiembre de 2021 y Decreto 229/2011, de 7 de diciembre (Galicia).",
    });
    const [selectedContents, setSelectedContents] = useState<string[]>([]);
    const [localValidationError, setLocalValidationError] = useState<string | null>(null);

    useEffect(() => {
        const loadCurriculum = async () => {
            try {
                setCurriculumLoading(true);
                const catalog = await normativeService.getGaliciaPrimaryCurriculum();
                setCurriculumAreas(catalog.areas || []);
                if (catalog.areas?.length > 0) {
                    setFormData((prev) => ({
                        ...prev,
                        area_educativa: prev.area_educativa || catalog.areas[0].area_name,
                    }));
                }
            } catch (loadError) {
                console.error(loadError);
                setCurriculumError(
                    "No se pudo cargar el catalogo curricular de Galicia. Puedes continuar con contenidos manuales."
                );
            } finally {
                setCurriculumLoading(false);
            }
        };

        void loadCurriculum();
    }, []);

    const currentArea = useMemo(
        () => curriculumAreas.find((area) => area.area_name === formData.area_educativa),
        [curriculumAreas, formData.area_educativa]
    );

    useEffect(() => {
        setSelectedContents([]);
    }, [formData.area_educativa]);

    const toggleContent = (content: string) => {
        setSelectedContents((previous) =>
            previous.includes(content)
                ? previous.filter((item) => item !== content)
                : [...previous, content]
        );
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLocalValidationError(null);

        const manualContents = splitManualContents(formData.contenidos_manual);
        const mergedContents = Array.from(
            new Set([...selectedContents, ...manualContents])
        );

        if (mergedContents.length === 0) {
            setLocalValidationError("Selecciona al menos un contenido a reforzar.");
            return;
        }

        await runGeneration((onChunk, options) =>
            generatorService.generateReinforcementPlan(
                {
                    area_educativa: formData.area_educativa,
                    curso: formData.curso,
                    etapa_educativa: formData.etapa_educativa,
                    fecha_inicio_refuerzo: formData.fecha_inicio_refuerzo,
                    fecha_fin_estimada: formData.fecha_fin_estimada,
                    contenidos_refuerzo: mergedContents,
                    criterios_evaluacion: formData.criterios_evaluacion,
                    instrumentos_evaluacion: formData.instrumentos_evaluacion,
                    evidencias_necesidad_refuerzo: formData.evidencias_necesidad_refuerzo,
                    forma_trabajo_aplicada: formData.forma_trabajo_aplicada,
                    recursos_empleados: formData.recursos_empleados,
                    desarrollo_aplicado: formData.desarrollo_aplicado,
                    normativa_aplicable: formData.normativa_aplicable,
                    provider: engine,
                    api_key: apiKey,
                },
                onChunk,
                options
            )
        );
    };

    return (
        <GeneratorLayout
            title="Plan de Refuerzo (Atencion a la Diversidad)"
            description="Genera planes de refuerzo anonimizados, estructurados y alineados con normativa de Galicia."
            errorMessage={error || localValidationError}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="prose prose-invert max-w-none">
                    {!output && !loading ? (
                        <span className="text-slate-500">
                            El plan de refuerzo se mostrara aqui con estructura operativa.
                        </span>
                    ) : null}
                    {output ? <div className="whitespace-pre-wrap">{output}</div> : null}
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

                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold">Proteccion de datos activa</p>
                            <p>
                                Este formulario no recoge nombre, apellidos ni identificadores personales. El plan se
                                genera de forma anonima.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Area educativa</label>
                        <select
                            required
                            value={formData.area_educativa}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, area_educativa: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                            disabled={curriculumLoading}
                        >
                            {curriculumAreas.map((area) => (
                                <option key={area.area_id} value={area.area_name}>
                                    {area.area_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Curso</label>
                        <select
                            required
                            value={formData.curso}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, curso: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        >
                            {PRIMARY_COURSES.map((course) => (
                                <option key={course} value={course}>
                                    {course}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Etapa educativa</label>
                        <input
                            required
                            value={formData.etapa_educativa}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, etapa_educativa: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Inicio del refuerzo</label>
                        <input
                            required
                            type="date"
                            value={formData.fecha_inicio_refuerzo}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, fecha_inicio_refuerzo: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Fin estimado</label>
                        <input
                            required
                            type="date"
                            value={formData.fecha_fin_estimada}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, fecha_fin_estimada: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                        Contenidos curriculares a reforzar (Galicia Primaria)
                    </label>
                    {curriculumLoading ? (
                        <div className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cargando contenidos curriculares...
                        </div>
                    ) : null}
                    {curriculumError ? (
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                            {curriculumError}
                        </div>
                    ) : null}
                    {currentArea?.contents?.length ? (
                        <div className="max-h-52 overflow-y-auto rounded border border-white/10 bg-[#1a1f2e] p-3 space-y-2">
                            {currentArea.contents.map((content) => {
                                const checked = selectedContents.includes(content);
                                return (
                                    <label key={content} className="flex items-start gap-2 text-sm text-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleContent(content)}
                                            className="mt-1"
                                        />
                                        <span>{content}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : null}
                    <textarea
                        value={formData.contenidos_manual}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, contenidos_manual: event.target.value }))
                        }
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="Si necesitas, añade contenidos manuales (separados por linea, coma o punto y coma)."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Criterios de evaluacion asociados</label>
                    <textarea
                        required
                        value={formData.criterios_evaluacion}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, criterios_evaluacion: event.target.value }))
                        }
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="Describe criterios vinculados al area y al contenido no superado."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                        Instrumentos de evaluacion aplicados y datos de evidencia
                    </label>
                    <textarea
                        required
                        value={formData.instrumentos_evaluacion}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, instrumentos_evaluacion: event.target.value }))
                        }
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="Ej: pruebas escritas, rubricas, observacion sistematica, tareas de desempeno..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                        Evidencias que avalan la necesidad de refuerzo
                    </label>
                    <textarea
                        required
                        value={formData.evidencias_necesidad_refuerzo}
                        onChange={(event) =>
                            setFormData((prev) => ({
                                ...prev,
                                evidencias_necesidad_refuerzo: event.target.value,
                            }))
                        }
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        placeholder="Aporta resultados observables: calificaciones, indicadores, brechas detectadas..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Forma de trabajo aplicada</label>
                        <textarea
                            required
                            value={formData.forma_trabajo_aplicada}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, forma_trabajo_aplicada: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Recursos empleados</label>
                        <textarea
                            required
                            value={formData.recursos_empleados}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recursos_empleados: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Desarrollo aplicado</label>
                        <textarea
                            required
                            value={formData.desarrollo_aplicado}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, desarrollo_aplicado: event.target.value }))
                            }
                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white h-24 resize-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Normativa aplicable</label>
                    <input
                        required
                        value={formData.normativa_aplicable}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, normativa_aplicable: event.target.value }))
                        }
                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Generar Plan de Refuerzo
                </button>
            </form>
        </GeneratorLayout>
    );
}
