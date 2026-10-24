/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * WeeklyPlanner - Weekly planning workspace for Teacher Premium
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { NoticeBanner } from "@/components/NoticeBanner";
import {
    classroomService,
    plannerService,
    resourceService,
    type ClassSchedule,
    type GeneratedResource,
    type GeneratePlannerSequenceRequest,
    type PlannerEntry,
    type PlannerSequenceResponse,
    type TeacherClass,
} from "@/lib/classroom-service";
import {
    normativeService,
    type CurriculumAreaItem,
} from "@/lib/normative-retrieval";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const EDUMIND_APP_OPTIONS = [
    { id: "edumind_quiz", label: "EDUmind Quiz" },
    { id: "edumind_motion", label: "EDUmind Motion" },
    { id: "edumind_pasos", label: "EDUmind Pasos" },
    { id: "edumind_robotics", label: "EDUmind Robotics" },
    { id: "edumind_geobreath", label: "EDUmind Geobreath" },
    { id: "liga_de_valores", label: "Liga de Valores" },
    { id: "moodle", label: "Moodle" },
];

function getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function parseDateString(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
}

function splitLines(raw: string): string[] {
    return raw
        .split(/\n|;|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function uniqueStrings(items: string[]): string[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.trim().toLocaleLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeKey(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function inferStageFromCourse(course: string): string {
    const normalized = normalizeKey(course);
    if (normalized.includes("primaria")) return "Educación Primaria";
    if (normalized.includes("infantil")) return "Educación Infantil";
    if (normalized.includes("eso")) return "Educación Secundaria Obligatoria";
    if (normalized.includes("bach")) return "Bachillerato";
    if (normalized.includes("fp")) return "Formación Profesional";
    return "Etapa educativa";
}

function methodologyLabel(value: number): string {
    if (value <= 33) return "Más tradicional y guiada";
    if (value <= 66) return "Equilibrada";
    return "Más activa e innovadora";
}

function findCurriculumArea(subject: string, areas: CurriculumAreaItem[]): CurriculumAreaItem | undefined {
    const normalizedSubject = normalizeKey(subject);
    return areas.find((item) => normalizeKey(item.area_name) === normalizedSubject);
}

export default function WeeklyPlanner() {
    const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
    const [entries, setEntries] = useState<PlannerEntry[]>([]);
    const [classes, setClasses] = useState<TeacherClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [confirmGenerate, setConfirmGenerate] = useState(false);
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);

    const [curriculumAreas, setCurriculumAreas] = useState<CurriculumAreaItem[]>([]);
    const [curriculumLoading, setCurriculumLoading] = useState(true);
    const [curriculumError, setCurriculumError] = useState<string | null>(null);

    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [classSchedule, setClassSchedule] = useState<ClassSchedule[]>([]);
    const [classResources, setClassResources] = useState<GeneratedResource[]>([]);
    const [classContextLoading, setClassContextLoading] = useState(false);

    const [sequenceTitle, setSequenceTitle] = useState("");
    const [area, setArea] = useState("");
    const [stage, setStage] = useState("");
    const [startDate, setStartDate] = useState(() => formatDate(getMonday(new Date())));
    const [sessionCount, setSessionCount] = useState(5);
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
    const [manualCriteria, setManualCriteria] = useState("");
    const [selectedContents, setSelectedContents] = useState<string[]>([]);
    const [manualContents, setManualContents] = useState("");
    const [methodologySlider, setMethodologySlider] = useState(60);
    const [methodologyNotes, setMethodologyNotes] = useState("");
    const [additionalProposals, setAdditionalProposals] = useState("");
    const [duaDiversity, setDuaDiversity] = useState("");
    const [webResources, setWebResources] = useState("");
    const [edumindSiteResources, setEdumindSiteResources] = useState("");
    const [externalResources, setExternalResources] = useState("");
    const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
    const [selectedLinkedResourceIds, setSelectedLinkedResourceIds] = useState<number[]>([]);
    const [plannerBusy, setPlannerBusy] = useState(false);
    const [plannerError, setPlannerError] = useState<string | null>(null);
    const [generatedPlan, setGeneratedPlan] = useState<PlannerSequenceResponse | null>(null);
    const [lastPayload, setLastPayload] = useState<GeneratePlannerSequenceRequest | null>(null);

    const weekDates = useMemo(() => DAYS.map((_, i) => addDays(currentMonday, i)), [currentMonday]);
    const selectedClass = useMemo(
        () => classes.find((teacherClass) => teacherClass.id === selectedClassId) ?? null,
        [classes, selectedClassId]
    );
    const curriculumArea = useMemo(
        () => findCurriculumArea(area, curriculumAreas),
        [area, curriculumAreas]
    );

    const availableAreaOptions = useMemo(() => {
        const rawOptions = [
            ...(selectedClass?.subject ? [selectedClass.subject] : []),
            ...curriculumAreas.map((item) => item.area_name),
        ];
        return uniqueStrings(rawOptions);
    }, [curriculumAreas, selectedClass]);

    useEffect(() => {
        const today = formatDate(new Date());
        const index = weekDates.findIndex((d) => formatDate(d) === today);
        setActiveDayIndex(index >= 0 ? index : 0);
    }, [weekDates]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [entriesData, classesData] = await Promise.all([
                plannerService.getWeekPlanner(formatDate(currentMonday)),
                classroomService.getClasses(),
            ]);
            setEntries(entriesData);
            setClasses(classesData);
            setSelectedClassId((previous) => previous ?? classesData[0]?.id ?? null);
        } catch (err) {
            console.error(err);
            setNotice({ variant: "error", message: "No se pudieron cargar las clases y el planner." });
        } finally {
            setLoading(false);
        }
    }, [currentMonday]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        const loadCurriculum = async () => {
            try {
                setCurriculumLoading(true);
                const catalog = await normativeService.getGaliciaPrimaryCurriculum();
                setCurriculumAreas(catalog.areas || []);
            } catch (error) {
                console.error(error);
                setCurriculumError(
                    "No se pudo cargar el catálogo curricular inicial. Puedes seguir con criterios y contenidos manuales."
                );
            } finally {
                setCurriculumLoading(false);
            }
        };

        void loadCurriculum();
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setClassSchedule([]);
            setClassResources([]);
            return;
        }

        setClassContextLoading(true);
        const suggestedArea = selectedClass.subject;
        const suggestedStage = inferStageFromCourse(selectedClass.course);
        setArea(suggestedArea);
        setStage(suggestedStage);
        setSelectedCriteria([]);
        setSelectedContents([]);
        setGeneratedPlan(null);
        setLastPayload(null);

        Promise.all([
            classroomService.getSchedule(selectedClass.id),
            resourceService.getResourcesByClass(selectedClass.id),
        ])
            .then(([scheduleData, resourcesData]) => {
                setClassSchedule(scheduleData);
                setClassResources(resourcesData);
                setSelectedLinkedResourceIds([]);
            })
            .catch((error) => {
                console.error(error);
                setNotice({
                    variant: "error",
                    message: "No se pudieron cargar el horario y los recursos vinculados de la clase.",
                });
            })
            .finally(() => {
                setClassContextLoading(false);
            });
    }, [selectedClass]);

    useEffect(() => {
        if (!curriculumArea) {
            setSelectedCriteria([]);
            setSelectedContents([]);
        }
    }, [curriculumArea]);

    const goToPreviousWeek = () => setCurrentMonday(addDays(currentMonday, -7));
    const goToNextWeek = () => setCurrentMonday(addDays(currentMonday, 7));
    const goToToday = () => setCurrentMonday(getMonday(new Date()));

    const getEntriesForDay = (currentDate: Date) => {
        const dateStr = formatDate(currentDate);
        return entries
            .filter((entry) => entry.entry_date === dateStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    };

    const getClassById = (id: number) => classes.find((teacherClass) => teacherClass.id === id);

    const handleStatusChange = async (entryId: number, status: PlannerEntry["status"]) => {
        try {
            await plannerService.updateStatus(entryId, status);
            setEntries((previous) =>
                previous.map((entry) => (entry.id === entryId ? { ...entry, status } : entry))
            );
        } catch (error) {
            console.error(error);
            setNotice({ variant: "error", message: "No se pudo actualizar el estado de la sesión." });
        }
    };

    const handleGenerateFromSchedule = async () => {
        try {
            setLoading(true);
            setConfirmGenerate(false);
            await plannerService.createFromSchedule(formatDate(currentMonday), 1);
            await loadData();
            setNotice({ variant: "success", message: "Planner semanal generado a partir del horario." });
        } catch (error) {
            console.error(error);
            setNotice({ variant: "error", message: "No se pudieron generar las entradas automáticas." });
        }
    };

    const toggleSelection = (value: string, current: string[], setter: (items: string[]) => void) => {
        setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    };

    const toggleResourceSelection = (resourceId: number) => {
        setSelectedLinkedResourceIds((previous) =>
            previous.includes(resourceId)
                ? previous.filter((item) => item !== resourceId)
                : [...previous, resourceId]
        );
    };

    const buildPayload = (): GeneratePlannerSequenceRequest | null => {
        if (!selectedClass) {
            setPlannerError("Selecciona primero una clase para contextualizar la planificación.");
            return null;
        }

        const mergedCriteria = uniqueStrings([...selectedCriteria, ...splitLines(manualCriteria)]);
        const mergedContents = uniqueStrings([...selectedContents, ...splitLines(manualContents)]);
        if (!sequenceTitle.trim()) {
            setPlannerError("Indica un foco o título para la secuencia.");
            return null;
        }
        if (!area.trim()) {
            setPlannerError("Indica el área o materia.");
            return null;
        }
        if (mergedCriteria.length === 0) {
            setPlannerError("Añade al menos un criterio de evaluación.");
            return null;
        }
        if (mergedContents.length === 0) {
            setPlannerError("Añade al menos un contenido asociado.");
            return null;
        }

        return {
            class_id: selectedClass.id,
            start_date: startDate,
            session_count: sessionCount,
            sequence_title: sequenceTitle.trim(),
            area: area.trim(),
            stage: stage.trim(),
            criteria: mergedCriteria,
            contents: mergedContents,
            methodology_slider: methodologySlider,
            methodology_notes: methodologyNotes.trim(),
            additional_proposals: additionalProposals.trim(),
            dua_diversity: duaDiversity.trim(),
            web_resources: splitLines(webResources),
            edumind_resource_refs: splitLines(edumindSiteResources),
            linked_resource_ids: selectedLinkedResourceIds,
            edumind_apps: selectedAppIds,
            external_resource_refs: splitLines(externalResources),
        };
    };

    const handlePreviewGeneration = async (event: React.FormEvent) => {
        event.preventDefault();
        setPlannerBusy(true);
        setPlannerError(null);
        const payload = buildPayload();
        if (!payload) {
            setPlannerBusy(false);
            return;
        }

        try {
            const response = await plannerService.generateSequence({ ...payload, persist: false });
            setGeneratedPlan(response);
            setLastPayload(payload);
            setNotice({
                variant: "success",
                message: "Previsualización generada. Revisa la tabla antes de guardar en el planner.",
            });
        } catch (error) {
            console.error(error);
            setGeneratedPlan(null);
            setPlannerError("No se pudo generar la secuencia. Revisa los datos introducidos e inténtalo de nuevo.");
        } finally {
            setPlannerBusy(false);
        }
    };

    const handlePersistGeneration = async () => {
        const payload = lastPayload ?? buildPayload();
        if (!payload) return;

        setPlannerBusy(true);
        setPlannerError(null);
        try {
            const response = await plannerService.generateSequence({ ...payload, persist: true });
            setGeneratedPlan(response);
            await loadData();
            if (response.created_entries.length > 0) {
                setCurrentMonday(getMonday(parseDateString(response.created_entries[0].entry_date)));
            }
            setNotice({
                variant: "success",
                message: "Planificación guardada en el planner con sesiones fechadas y recurso de resumen vinculado.",
            });
        } catch (error) {
            console.error(error);
            setPlannerError(
                "No se pudo guardar la secuencia en el planner. Revisa si ya existen entradas en esos huecos."
            );
        } finally {
            setPlannerBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-paper text-ink">
            <div className="lam-wrap py-10">
                {notice ? (
                    <NoticeBanner
                        variant={notice.variant}
                        message={notice.message}
                        className="mb-4"
                        onClose={() => setNotice(null)}
                    />
                ) : null}
                {plannerError ? (
                    <NoticeBanner
                        variant="error"
                        message={plannerError}
                        className="mb-4"
                        onClose={() => setPlannerError(null)}
                    />
                ) : null}

                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="lam-mono mb-4">
                                <Link to="/classroom" className="lam-mono-ink hover:underline underline-offset-4">Mis clases</Link>
                                <span className="mx-2">/</span>
                                <span>Planificación semanal</span>
                            </div>
                            <h1 className="lam-h1">Planificación <span className="light">semanal</span></h1>
                            <p className="lam-lede mt-5 !max-w-[60ch]">
                                Diseña una secuencia didáctica guiada, distribuye contenidos y criterios por sesiones
                                reales del horario y guarda el resultado directamente en el planner docente.
                            </p>
                        </div>

                        <div className="flex w-full md:w-auto gap-2">
                            <button type="button" onClick={() => setConfirmGenerate(true)} className="lam-btn w-full md:w-auto">
                                Generar desde horario
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6 mb-8">
                    <section className="border-t-2 border-rule pt-5">
                        <div className="lam-sec-head">
                            <span className="lam-sec-num">01</span>
                            <div className="flex-1">
                                <h2>Constructor de secuencia</h2>
                                <p className="text-sm text-ink-2 mt-2 mb-0">
                                    Recoge criterios, contenidos, recursos y DUA para convertirlos en sesiones
                                    calendarizadas.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handlePreviewGeneration} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="lam-label">Clase</label>
                                    <select
                                        value={selectedClassId ?? ""}
                                        onChange={(event) =>
                                            setSelectedClassId(event.target.value ? Number(event.target.value) : null)
                                        }
                                        className="lam-input"
                                    >
                                        {classes.length === 0 ? <option value="">Sin clases</option> : null}
                                        {classes.map((teacherClass) => (
                                            <option key={teacherClass.id} value={teacherClass.id}>
                                                {teacherClass.name} · {teacherClass.subject}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="lam-label">Título o foco de la secuencia</label>
                                    <input
                                        value={sequenceTitle}
                                        onChange={(event) => setSequenceTitle(event.target.value)}
                                        className="lam-input"
                                        placeholder="Ej. Condición física saludable y autorregulación"
                                        required
                                    />
                                </div>
                            </div>

                            {selectedClass ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <PlannerContextBadge label="Curso" value={selectedClass.course} />
                                    <PlannerContextBadge label="Grupo" value={selectedClass.group} />
                                    <PlannerContextBadge label="Materia" value={selectedClass.subject} />
                                    <PlannerContextBadge label="Año" value={selectedClass.academic_year} />
                                </div>
                            ) : null}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="lam-label">Área o materia</label>
                                    <select
                                        value={area}
                                        onChange={(event) => setArea(event.target.value)}
                                        className="lam-input"
                                    >
                                        {availableAreaOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="lam-label">Fecha de inicio</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(event) => setStartDate(event.target.value)}
                                        className="lam-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="lam-label">Nº de sesiones</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={sessionCount}
                                        onChange={(event) => setSessionCount(Number(event.target.value))}
                                        className="lam-input"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="lam-label">Etapa</label>
                                    <input
                                        value={stage}
                                        onChange={(event) => setStage(event.target.value)}
                                        className="lam-input"
                                        placeholder="Educación Primaria / ESO / Bachillerato..."
                                    />
                                </div>
                                <div className="lam-note mental text-sm">
                                    {classContextLoading ? (
                                        <span className="lam-mono animate-pulse">Cargando horario y recursos</span>
                                    ) : classSchedule.length > 0 ? (
                                        <div className="space-y-2">
                                            <span className="tag">Horario detectado</span>
                                            <div className="flex flex-wrap gap-2">
                                                {classSchedule.map((slot) => (
                                                    <span key={slot.id} className="font-mono text-[12px] border border-hair px-2.5 py-1 text-ink-2">
                                                        {DAYS[slot.day_of_week]} · {slot.start_time}–{slot.end_time}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <span>
                                            No hay horario configurado para esta clase. La secuencia usará días lectivos
                                            consecutivos.
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="lam-panel">
                                    <h3 className="lam-mono mb-3">Criterios de evaluación</h3>
                                    {curriculumLoading ? (
                                        <div className="lam-mono animate-pulse mb-3">Cargando criterios sugeridos</div>
                                    ) : curriculumArea?.evaluation_criteria?.length ? (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {curriculumArea.evaluation_criteria.map((criterion) => (
                                                <SelectablePill
                                                    key={criterion}
                                                    label={criterion}
                                                    selected={selectedCriteria.includes(criterion)}
                                                    onClick={() => toggleSelection(criterion, selectedCriteria, setSelectedCriteria)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-ink-2 mb-3">
                                            No hay criterios sugeridos para esta materia; puedes introducirlos manualmente.
                                        </div>
                                    )}
                                    <textarea
                                        value={manualCriteria}
                                        onChange={(event) => setManualCriteria(event.target.value)}
                                        rows={4}
                                        className="lam-input"
                                        placeholder="Añade criterios propios, uno por línea o separados por punto y coma."
                                    />
                                </div>

                                <div className="lam-panel">
                                    <h3 className="lam-mono mb-3">Contenidos asociados</h3>
                                    {curriculumLoading ? (
                                        <div className="lam-mono animate-pulse mb-3">Cargando contenidos sugeridos</div>
                                    ) : curriculumArea?.contents?.length ? (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {curriculumArea.contents.map((content) => (
                                                <SelectablePill
                                                    key={content}
                                                    label={content}
                                                    selected={selectedContents.includes(content)}
                                                    onClick={() => toggleSelection(content, selectedContents, setSelectedContents)}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-ink-2 mb-3">
                                            No hay contenidos sugeridos para esta materia; puedes introducirlos manualmente.
                                        </div>
                                    )}
                                    <textarea
                                        value={manualContents}
                                        onChange={(event) => setManualContents(event.target.value)}
                                        rows={4}
                                        className="lam-input"
                                        placeholder="Añade contenidos propios, uno por línea o separados por punto y coma."
                                    />
                                </div>
                            </div>

                            {curriculumError ? (
                                <div className="lam-note vigencia text-sm">
                                    <span className="tag">Atención</span>
                                    <p className="m-0">{curriculumError}</p>
                                </div>
                            ) : null}

                            <div className="lam-panel">
                                <h3 className="lam-mono mb-3">Metodología, DUA y propuestas</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="lam-label">
                                            Slider innovación-tradición
                                        </label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={methodologySlider}
                                            onChange={(event) => setMethodologySlider(Number(event.target.value))}
                                            className="w-full accent-ink"
                                        />
                                        <div className="lam-mono lam-mono-ink">{methodologyLabel(methodologySlider)}</div>
                                        <textarea
                                            value={methodologyNotes}
                                            onChange={(event) => setMethodologyNotes(event.target.value)}
                                            rows={4}
                                            className="lam-input"
                                            placeholder="Agrupamientos, dinámica, evaluación formativa, rutinas, estaciones, ABP..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <textarea
                                            value={duaDiversity}
                                            onChange={(event) => setDuaDiversity(event.target.value)}
                                            rows={4}
                                            className="lam-input"
                                            placeholder="DUA y atención a la diversidad: apoyos, andamiajes, accesibilidad, agrupamientos flexibles..."
                                        />
                                        <textarea
                                            value={additionalProposals}
                                            onChange={(event) => setAdditionalProposals(event.target.value)}
                                            rows={4}
                                            className="lam-input"
                                            placeholder="Propuestas adicionales: producto final, proyecto, evaluación, transversalidad, coordinación..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="lam-panel">
                                    <h3 className="lam-mono mb-3">Recursos y apps</h3>
                                    <div className="space-y-3">
                                        <textarea
                                            value={webResources}
                                            onChange={(event) => setWebResources(event.target.value)}
                                            rows={3}
                                            className="lam-input"
                                            placeholder="Recursos web, uno por línea: REA, webs, museos, simuladores, artículos..."
                                        />
                                        <textarea
                                            value={edumindSiteResources}
                                            onChange={(event) => setEdumindSiteResources(event.target.value)}
                                            rows={3}
                                            className="lam-input"
                                            placeholder="Referencias a edumind.es/recursos, una por línea."
                                        />
                                        <textarea
                                            value={externalResources}
                                            onChange={(event) => setExternalResources(event.target.value)}
                                            rows={3}
                                            className="lam-input"
                                            placeholder="Audiovisuales, PDF, imágenes, proyectos o materiales físicos/digitales."
                                        />
                                    </div>
                                </div>

                                <div className="lam-panel">
                                    <h3 className="lam-mono mb-3">Ecosistema EDUmind</h3>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {EDUMIND_APP_OPTIONS.map((app) => (
                                            <SelectablePill
                                                key={app.id}
                                                label={app.label}
                                                selected={selectedAppIds.includes(app.id)}
                                                onClick={() => toggleSelection(app.id, selectedAppIds, setSelectedAppIds)}
                                            />
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="lam-label">
                                            Recursos vinculados a la clase
                                        </label>
                                        {classResources.length === 0 ? (
                                            <div className="text-sm text-ink-2">
                                                No hay recursos guardados y vinculados a esta clase todavía.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                                {classResources.map((resource) => (
                                                    <label
                                                        key={resource.id}
                                                        className="flex items-start gap-3 border-b border-hair px-1 py-2 text-sm"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLinkedResourceIds.includes(resource.id)}
                                                            onChange={() => toggleResourceSelection(resource.id)}
                                                            className="mt-1"
                                                        />
                                                        <div>
                                                            <div className="font-medium text-ink">{resource.title}</div>
                                                            <div className="text-xs text-ink-2">
                                                                Tipo: {resource.resource_type}
                                                            </div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-3">
                                <button type="submit" disabled={plannerBusy} className="lam-btn">
                                    {plannerBusy ? "Generando..." : "Previsualizar tabla de sesiones"}
                                </button>
                                <button
                                    type="button"
                                    disabled={plannerBusy || !generatedPlan}
                                    onClick={() => void handlePersistGeneration()}
                                    className="lam-btn lam-btn-ghost"
                                >
                                    Guardar en el planificador
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="border-t-2 border-rule pt-5">
                        <div className="lam-sec-head">
                            <span className="lam-sec-num">02</span>
                            <div className="flex-1">
                                <h2>Previsualización de la secuencia</h2>
                                <p className="text-sm text-ink-2 mt-2 mb-0">
                                    Tabla de sesiones con fechas reales antes de insertar las entradas en la semana.
                                </p>
                            </div>
                        </div>

                        {generatedPlan ? (
                            <div className="space-y-4">
                                        {generatedPlan.warnings.length > 0 ? (
                                            <div className="space-y-2">
                                                {generatedPlan.warnings.map((warning) => (
                                                    <NoticeBanner
                                                        key={warning}
                                                        variant="info"
                                                        message={warning}
                                                    />
                                                ))}
                                            </div>
                                ) : null}
                                <GeneratedPlanPreview plan={generatedPlan} />
                            </div>
                        ) : (
                            <div className="min-h-[320px] border border-hair bg-card p-6 text-sm text-ink-2">
                                La tabla aparecerá aquí cuando generes una secuencia. Verás las sesiones con fecha,
                                horario, criterios, contenidos, metodología y recursos previstos.
                            </div>
                        )}
                    </section>
                </div>

                {/* Navegación semanal */}
                <div className="border-t-2 border-rule border-b border-b-hair py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">
                        <span className="lam-mono block mb-1">03 · Semana</span>
                        Semana del{" "}
                        {currentMonday.toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "long",
                        })}
                    </h2>
                    <div className="lam-seg">
                        <button type="button" onClick={goToPreviousWeek}>← Anterior</button>
                        <button type="button" onClick={goToToday}>Hoy</button>
                        <button type="button" onClick={goToNextWeek}>Siguiente →</button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="lam-mono animate-pulse">Cargando planificador</span>
                    </div>
                ) : (
                    <>
                        <div className="md:hidden mb-4 overflow-x-auto scrollbar-thin">
                            <div className="flex gap-2 min-w-max pb-1">
                                {weekDates.map((date, dayIndex) => {
                                    const isActive = dayIndex === activeDayIndex;
                                    return (
                                        <button
                                            key={`tab-${dayIndex}`}
                                            type="button"
                                            onClick={() => setActiveDayIndex(dayIndex)}
                                            className={`font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-2 border border-ink transition-colors ${
                                                isActive ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"
                                            }`}
                                        >
                                            {DAYS[dayIndex]} {date.toLocaleDateString("es-ES", { day: "numeric" })}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="md:hidden">
                            <DayColumn
                                date={weekDates[activeDayIndex]}
                                dayName={DAYS[activeDayIndex]}
                                entries={getEntriesForDay(weekDates[activeDayIndex])}
                                getClassById={getClassById}
                                onStatusChange={handleStatusChange}
                            />
                        </div>

                        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-0 border-t-2 border-rule border-l border-hair">
                            {weekDates.map((date, dayIndex) => (
                                <DayColumn
                                    key={dayIndex}
                                    date={date}
                                    dayName={DAYS[dayIndex]}
                                    entries={getEntriesForDay(date)}
                                    getClassById={getClassById}
                                    onStatusChange={handleStatusChange}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <ConfirmationDialog
                open={confirmGenerate}
                title="Generar planner desde el horario"
                description="Se crearán entradas base de esta semana a partir del horario de clases actual. Si ya hay entradas manuales, revísalas después para evitar duplicidades."
                confirmLabel="Generar entradas"
                onConfirm={() => void handleGenerateFromSchedule()}
                onCancel={() => setConfirmGenerate(false)}
            />
        </div>
    );
}

function PlannerContextBadge({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-b border-hair py-2">
            <div className="lam-mono">{label}</div>
            <div className="text-[15px] font-semibold text-ink mt-1">{value}</div>
        </div>
    );
}

function SelectablePill({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={`border px-3 py-1.5 text-xs text-left transition-colors ${
                selected
                    ? "border-ink bg-ink text-paper"
                    : "border-hair bg-paper text-ink-2 hover:border-ink hover:text-ink"
            }`}
        >
            {label}
        </button>
    );
}

function GeneratedPlanPreview({ plan }: { plan: PlannerSequenceResponse }) {
    return (
        <div className="space-y-4">
            <div className="lam-panel text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="lam-badge b-mental">{plan.class_name}</span>
                    <span className="lam-mono lam-mono-ink border border-ink px-2.5 py-2">
                        {plan.schedule_based ? "Con horario real" : "Sin horario configurado"}
                    </span>
                    {plan.persisted && plan.planning_resource_title ? (
                        <span className="lam-stamp">{plan.planning_resource_title}</span>
                    ) : null}
                </div>
                <div className="text-ink-2">
                    {plan.occupied_slots.length > 0
                        ? `Huecos ya ocupados detectados: ${plan.occupied_slots.join(", ")}`
                        : "No se detectaron huecos ocupados para esta secuencia."}
                </div>
            </div>

            <div className="overflow-x-auto border border-hair">
                <table className="lam-table min-w-full text-sm !m-0">
                    <thead>
                        <tr>
                            <th>Sesión</th>
                            <th>Fecha</th>
                            <th>Horario</th>
                            <th>Título</th>
                            <th>Criterios</th>
                            <th>Contenidos</th>
                            <th>Recursos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plan.sessions.map((session, index) => (
                            <tr
                                key={`${session.entry_date}-${session.start_time}-${index}`}
                                className="align-top"
                            >
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="font-medium text-ink">{session.session_number}</div>
                                    <div className="text-xs text-ink-2">{session.phase_label}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="text-ink">{session.day_label}</div>
                                    <div className="text-xs text-ink-2">{session.entry_date}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-ink">
                                    {session.start_time} - {session.end_time}
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <div className="font-medium text-ink">{session.title}</div>
                                    <div className="text-xs text-ink-2 mt-1">{session.focus}</div>
                                    <div className="lam-mono mt-2 normal-case tracking-normal">{session.methodology}</div>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <ul className="space-y-1 text-ink">
                                        {session.criteria.map((criterion) => (
                                            <li key={criterion}>— {criterion}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <ul className="space-y-1 text-ink">
                                        {session.contents.map((content) => (
                                            <li key={content}>— {content}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    {session.resources.length > 0 ? (
                                        <ul className="space-y-1 text-ink">
                                            {session.resources.map((resource) => (
                                                <li key={resource}>— {resource}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-ink-3">Sin recursos específicos</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="lam-note">
                <span className="tag">Resumen operativo generado</span>
                <pre className="m-0 whitespace-pre-wrap font-mono text-xs text-ink-2 overflow-x-auto">
                    {plan.planning_summary}
                </pre>
            </div>
        </div>
    );
}

interface DayColumnProps {
    date: Date;
    dayName: string;
    entries: PlannerEntry[];
    getClassById: (id: number) => TeacherClass | undefined;
    onStatusChange: (id: number, status: PlannerEntry["status"]) => void;
}

function DayColumn({ date, dayName, entries, getClassById, onStatusChange }: DayColumnProps) {
    const isToday = formatDate(date) === formatDate(new Date());

    return (
        <div className={`border-r border-b border-hair p-4 min-h-[320px] md:min-h-[420px] ${isToday ? "bg-card" : "bg-paper"}`}>
            {/* Cabecera del día en mono; el día actual invierte la tinta */}
            <div className={`mb-4 pb-2 border-b flex items-baseline justify-between gap-2 ${isToday ? "border-ink" : "border-hair"}`}>
                <span className={`lam-mono ${isToday ? "bg-ink text-paper px-2 py-1" : "lam-mono-ink"}`}>{dayName}</span>
                <span className="lam-mono">
                    {date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
            </div>

            <div className="space-y-2">
                {entries.map((entry) => {
                    const teacherClass = getClassById(entry.class_id);
                    return (
                        <div
                            key={entry.id}
                            className="p-3 bg-paper border border-hair border-l-[3px] transition-colors"
                            style={{ borderLeftColor: entry.color || teacherClass?.color || "var(--m-mental)" }}
                        >
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="font-mono text-[12px] text-ink-2">
                                    {entry.start_time}–{entry.end_time}
                                </div>
                                <StatusBadge status={entry.status} onStatusChange={(status) => onStatusChange(entry.id, status)} />
                            </div>
                            <div className="font-medium text-sm">{entry.title}</div>
                            {teacherClass ? (
                                <div className="lam-mono mt-1">
                                    {teacherClass.course} · {teacherClass.group} · {teacherClass.subject}
                                </div>
                            ) : null}
                            {entry.description ? (
                                <div className="text-xs text-ink-2 mt-2 line-clamp-4 whitespace-pre-wrap">
                                    {entry.description}
                                </div>
                            ) : null}
                            {entry.resource_id ? (
                                <div className="lam-mono lam-mono-ink mt-2">Recurso vinculado</div>
                            ) : null}
                        </div>
                    );
                })}

                {entries.length === 0 ? (
                    <div className="text-center py-8 text-ink-3 text-sm">Sin actividades</div>
                ) : null}
            </div>
        </div>
    );
}

function StatusBadge({
    status,
    onStatusChange,
}: {
    status: PlannerEntry["status"];
    onStatusChange: (status: PlannerEntry["status"]) => void;
}) {
    // Estado como etiqueta mono: planificada (hair), en curso (vigencia), hecha (ok), cancelada (alert)
    const statusConfig: Record<PlannerEntry["status"], { label: string; className: string }> = {
        planned: { label: "Plan.", className: "border-hair text-ink-2" },
        in_progress: { label: "En curso", className: "border-vigencia text-vigencia" },
        completed: { label: "Hecha", className: "border-ok text-ok" },
        cancelled: { label: "Cancel.", className: "border-alert text-alert" },
    };

    const config = statusConfig[status];

    const cycleStatus = () => {
        const order: PlannerEntry["status"][] = ["planned", "in_progress", "completed"];
        const currentIndex = order.indexOf(status);
        const nextIndex = (currentIndex + 1) % order.length;
        onStatusChange(order[nextIndex]);
    };

    return (
        <button
            type="button"
            onClick={cycleStatus}
            className={`font-mono text-[10px] uppercase tracking-[0.1em] border px-1.5 py-0.5 hover:bg-paper-2 transition-colors ${config.className}`}
            title={`Estado: ${status}`}
        >
            {config.label}
        </button>
    );
}

