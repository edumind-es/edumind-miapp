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

import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import {
    normativeService,
    type CurriculumAreaItem,
} from "@/lib/normative-retrieval";
import { getInitialEngine } from "@/lib/engine-preference";
import { CurriculumMatrixSelector } from "@/components/CurriculumMatrixSelector";
import type { MatrizCurricularRef } from "@/lib/curriculum-service";

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
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");
    const [matriz, setMatriz] = useState<MatrizCurricularRef | null>(null);

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
                    matriz_curricular: matriz ?? undefined,
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
                <div className="lam-prose">
                    {!output && !loading ? (
                        <span className="text-ink-3">
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

                <CurriculumMatrixSelector value={matriz} onChange={setMatriz} />

                <div className="lam-note vigencia">
                    <span className="tag">Proteccion de datos activa</span>
                    <p className="m-0 text-sm">
                        Este formulario no recoge nombre, apellidos ni identificadores personales. El plan se
                        genera de forma anonima.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-area-educativa">Area educativa</label>
                        <select id="reinforcementplan-area-educativa"
                            required
                            value={formData.area_educativa}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, area_educativa: event.target.value }))
                            }
                            className="lam-input"
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
                        <label className="lam-label" htmlFor="reinforcementplan-curso">Curso</label>
                        <select id="reinforcementplan-curso"
                            required
                            value={formData.curso}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, curso: event.target.value }))
                            }
                            className="lam-input"
                        >
                            <option value="">Selecciona un curso</option>
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
                        <label className="lam-label" htmlFor="reinforcementplan-etapa-educativa">Etapa educativa</label>
                        <input id="reinforcementplan-etapa-educativa"
                            required
                            value={formData.etapa_educativa}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, etapa_educativa: event.target.value }))
                            }
                            className="lam-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-inicio-del-refuerzo">Inicio del refuerzo</label>
                        <input id="reinforcementplan-inicio-del-refuerzo"
                            required
                            type="date"
                            value={formData.fecha_inicio_refuerzo}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, fecha_inicio_refuerzo: event.target.value }))
                            }
                            className="lam-input"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-fin-estimado">Fin estimado</label>
                        <input id="reinforcementplan-fin-estimado"
                            required
                            type="date"
                            value={formData.fecha_fin_estimada}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, fecha_fin_estimada: event.target.value }))
                            }
                            className="lam-input"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">
                        Contenidos curriculares a reforzar (Galicia Primaria)
                    </label>
                    {curriculumLoading ? (
                        <p className="lam-mono">Cargando contenidos curriculares...</p>
                    ) : null}
                    {curriculumError ? (
                        <div className="lam-note vigencia">
                            <span className="tag">Aviso</span>
                            <p className="m-0 text-sm">{curriculumError}</p>
                        </div>
                    ) : null}
                    {currentArea?.contents?.length ? (
                        <div className="max-h-52 overflow-y-auto border border-hair bg-card p-3 space-y-2">
                            {currentArea.contents.map((content) => {
                                const checked = selectedContents.includes(content);
                                return (
                                    <label key={content} className="flex items-start gap-2 text-sm text-ink">
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
                        className="lam-input h-24 resize-none"
                        placeholder="Si necesitas, añade contenidos manuales (separados por linea, coma o punto y coma)."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="reinforcementplan-criterios-de-evaluacion-asociados">Criterios de evaluacion asociados</label>
                    <textarea id="reinforcementplan-criterios-de-evaluacion-asociados"
                        required
                        value={formData.criterios_evaluacion}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, criterios_evaluacion: event.target.value }))
                        }
                        className="lam-input h-24 resize-none"
                        placeholder="Describe criterios vinculados al area y al contenido no superado."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">
                        Instrumentos de evaluacion aplicados y datos de evidencia
                    </label>
                    <textarea
                        required
                        value={formData.instrumentos_evaluacion}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, instrumentos_evaluacion: event.target.value }))
                        }
                        className="lam-input h-24 resize-none"
                        placeholder="Ej: pruebas escritas, rubricas, observacion sistematica, tareas de desempeno..."
                    />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">
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
                        className="lam-input h-24 resize-none"
                        placeholder="Aporta resultados observables: calificaciones, indicadores, brechas detectadas..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-forma-de-trabajo-aplicada">Forma de trabajo aplicada</label>
                        <textarea id="reinforcementplan-forma-de-trabajo-aplicada"
                            required
                            value={formData.forma_trabajo_aplicada}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, forma_trabajo_aplicada: event.target.value }))
                            }
                            className="lam-input h-24 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-recursos-empleados">Recursos empleados</label>
                        <textarea id="reinforcementplan-recursos-empleados"
                            required
                            value={formData.recursos_empleados}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, recursos_empleados: event.target.value }))
                            }
                            className="lam-input h-24 resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="reinforcementplan-desarrollo-aplicado">Desarrollo aplicado</label>
                        <textarea id="reinforcementplan-desarrollo-aplicado"
                            required
                            value={formData.desarrollo_aplicado}
                            onChange={(event) =>
                                setFormData((prev) => ({ ...prev, desarrollo_aplicado: event.target.value }))
                            }
                            className="lam-input h-24 resize-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="reinforcementplan-normativa-aplicable">Normativa aplicable</label>
                    <input id="reinforcementplan-normativa-aplicable"
                        required
                        value={formData.normativa_aplicable}
                        onChange={(event) =>
                            setFormData((prev) => ({ ...prev, normativa_aplicable: event.target.value }))
                        }
                        className="lam-input"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="lam-btn lam-btn-block"
                >
                    {loading ? <span className="font-mono" aria-hidden="true">···</span> : null}
                    Generar Plan de Refuerzo
                </button>
            </form>
        </GeneratorLayout>
    );
}
