/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * WeeklyPlanner - Weekly planning workspace for Teacher Premium
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    BookOpen,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Home,
    Layers3,
    Link2,
    Loader2,
    Sparkles,
    X,
} from "lucide-react";

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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            <div className="container mx-auto px-4 py-6">
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
                            <div className="flex items-center gap-3 text-slate-400 text-sm mb-2">
                                <Link to="/classroom" className="hover:text-white flex items-center gap-1">
                                    <Home size={14} /> Mis Clases
                                </Link>
                                <span>/</span>
                                <span className="text-white">Planificación semanal</span>
                            </div>
                            <h1 className="text-3xl font-bold">Planificación semanal</h1>
                            <p className="text-slate-400 mt-2 max-w-3xl">
                                Diseña una secuencia didáctica guiada, distribuye contenidos y criterios por sesiones
                                reales del horario y guarda el resultado directamente en el planner docente.
                            </p>
                        </div>

                        <div className="flex w-full md:w-auto gap-2">
                            <button
                                onClick={() => setConfirmGenerate(true)}
                                className="w-full md:w-auto px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm flex items-center justify-center gap-2"
                            >
                                <Calendar size={16} />
                                Generar desde horario
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6 mb-8">
                    <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <Sparkles className="text-cyan-300" size={20} />
                            <div>
                                <h2 className="text-xl font-semibold">Constructor de secuencia</h2>
                                <p className="text-sm text-slate-400">
                                    Recoge criterios, contenidos, recursos y DUA para convertirlos en sesiones
                                    calendarizadas.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handlePreviewGeneration} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Clase</label>
                                    <select
                                        value={selectedClassId ?? ""}
                                        onChange={(event) =>
                                            setSelectedClassId(event.target.value ? Number(event.target.value) : null)
                                        }
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
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
                                    <label className="text-sm font-medium text-slate-300">Título o foco de la secuencia</label>
                                    <input
                                        value={sequenceTitle}
                                        onChange={(event) => setSequenceTitle(event.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
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
                                    <label className="text-sm font-medium text-slate-300">Área o materia</label>
                                    <select
                                        value={area}
                                        onChange={(event) => setArea(event.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                    >
                                        {availableAreaOptions.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Fecha de inicio</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(event) => setStartDate(event.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Nº de sesiones</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={sessionCount}
                                        onChange={(event) => setSessionCount(Number(event.target.value))}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Etapa</label>
                                    <input
                                        value={stage}
                                        onChange={(event) => setStage(event.target.value)}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                        placeholder="Educación Primaria / ESO / Bachillerato..."
                                    />
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                    {classContextLoading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="animate-spin" size={14} /> Cargando horario y recursos...
                                        </span>
                                    ) : classSchedule.length > 0 ? (
                                        <div className="space-y-2">
                                            <span className="font-medium text-white">Horario detectado</span>
                                            <div className="flex flex-wrap gap-2">
                                                {classSchedule.map((slot) => (
                                                    <span key={slot.id} className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
                                                        {DAYS[slot.day_of_week]} · {slot.start_time}-{slot.end_time}
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
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <BookOpen size={16} className="text-cyan-300" />
                                        <h3 className="font-semibold">Criterios de evaluación</h3>
                                    </div>
                                    {curriculumLoading ? (
                                        <div className="text-sm text-slate-400 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> Cargando criterios sugeridos...
                                        </div>
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
                                        <div className="text-sm text-slate-400 mb-3">
                                            No hay criterios sugeridos para esta materia; puedes introducirlos manualmente.
                                        </div>
                                    )}
                                    <textarea
                                        value={manualCriteria}
                                        onChange={(event) => setManualCriteria(event.target.value)}
                                        rows={4}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                        placeholder="Añade criterios propios, uno por línea o separados por punto y coma."
                                    />
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Layers3 size={16} className="text-cyan-300" />
                                        <h3 className="font-semibold">Contenidos asociados</h3>
                                    </div>
                                    {curriculumLoading ? (
                                        <div className="text-sm text-slate-400 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> Cargando contenidos sugeridos...
                                        </div>
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
                                        <div className="text-sm text-slate-400 mb-3">
                                            No hay contenidos sugeridos para esta materia; puedes introducirlos manualmente.
                                        </div>
                                    )}
                                    <textarea
                                        value={manualContents}
                                        onChange={(event) => setManualContents(event.target.value)}
                                        rows={4}
                                        className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                        placeholder="Añade contenidos propios, uno por línea o separados por punto y coma."
                                    />
                                </div>
                            </div>

                            {curriculumError ? (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                    {curriculumError}
                                </div>
                            ) : null}

                            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <SlidersHorizontalIcon />
                                    <h3 className="font-semibold">Metodología, DUA y propuestas</h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-slate-300">
                                            Slider innovación-tradición
                                        </label>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={methodologySlider}
                                            onChange={(event) => setMethodologySlider(Number(event.target.value))}
                                            className="w-full accent-cyan-400"
                                        />
                                        <div className="text-sm text-cyan-200">{methodologyLabel(methodologySlider)}</div>
                                        <textarea
                                            value={methodologyNotes}
                                            onChange={(event) => setMethodologyNotes(event.target.value)}
                                            rows={4}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Agrupamientos, dinámica, evaluación formativa, rutinas, estaciones, ABP..."
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <textarea
                                            value={duaDiversity}
                                            onChange={(event) => setDuaDiversity(event.target.value)}
                                            rows={4}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="DUA y atención a la diversidad: apoyos, andamiajes, accesibilidad, agrupamientos flexibles..."
                                        />
                                        <textarea
                                            value={additionalProposals}
                                            onChange={(event) => setAdditionalProposals(event.target.value)}
                                            rows={4}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Propuestas adicionales: producto final, proyecto, evaluación, transversalidad, coordinación..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Link2 size={16} className="text-cyan-300" />
                                        <h3 className="font-semibold">Recursos y apps</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <textarea
                                            value={webResources}
                                            onChange={(event) => setWebResources(event.target.value)}
                                            rows={3}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Recursos web, uno por línea: REA, webs, museos, simuladores, artículos..."
                                        />
                                        <textarea
                                            value={edumindSiteResources}
                                            onChange={(event) => setEdumindSiteResources(event.target.value)}
                                            rows={3}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Referencias a edumind.es/recursos, una por línea."
                                        />
                                        <textarea
                                            value={externalResources}
                                            onChange={(event) => setExternalResources(event.target.value)}
                                            rows={3}
                                            className="w-full bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                                            placeholder="Audiovisuales, PDF, imágenes, proyectos o materiales físicos/digitales."
                                        />
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles size={16} className="text-cyan-300" />
                                        <h3 className="font-semibold">Ecosistema EDUmind</h3>
                                    </div>
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
                                        <label className="text-sm font-medium text-slate-300">
                                            Recursos vinculados a la clase
                                        </label>
                                        {classResources.length === 0 ? (
                                            <div className="text-sm text-slate-400">
                                                No hay recursos guardados y vinculados a esta clase todavía.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                                {classResources.map((resource) => (
                                                    <label
                                                        key={resource.id}
                                                        className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLinkedResourceIds.includes(resource.id)}
                                                            onChange={() => toggleResourceSelection(resource.id)}
                                                            className="mt-1"
                                                        />
                                                        <div>
                                                            <div className="font-medium text-white">{resource.title}</div>
                                                            <div className="text-xs text-slate-400">
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
                                <button
                                    type="submit"
                                    disabled={plannerBusy}
                                    className="px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {plannerBusy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Previsualizar tabla de sesiones
                                </button>
                                <button
                                    type="button"
                                    disabled={plannerBusy || !generatedPlan}
                                    onClick={() => void handlePersistGeneration()}
                                    className="px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    <Check size={16} />
                                    Guardar en el planner
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <Calendar className="text-blue-300" size={20} />
                            <div>
                                <h2 className="text-xl font-semibold">Previsualización de la secuencia</h2>
                                <p className="text-sm text-slate-400">
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
                            <div className="min-h-[320px] rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                                La tabla aparecerá aquí cuando generes una secuencia. Verás las sesiones con fecha,
                                horario, criterios, contenidos, metodología y recursos previstos.
                            </div>
                        )}
                    </section>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 mb-6 border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                        <button onClick={goToPreviousWeek} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronLeft size={22} />
                        </button>

                        <h2 className="text-base sm:text-xl font-semibold text-center">
                            Semana del{" "}
                            {currentMonday.toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "long",
                            })}
                        </h2>

                        <button onClick={goToNextWeek} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronRight size={22} />
                        </button>
                    </div>
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={goToToday}
                            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg"
                        >
                            Hoy
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-400" size={48} />
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
                                            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                                                isActive
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-white/5 text-slate-300 hover:bg-white/10"
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

                        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
            <div className="text-sm font-medium text-white mt-1">{value}</div>
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
            className={`rounded-full border px-3 py-1.5 text-xs text-left transition-colors ${
                selected
                    ? "border-cyan-400 bg-cyan-400/15 text-cyan-100"
                    : "border-white/10 bg-slate-900/50 text-slate-300 hover:bg-white/10"
            }`}
        >
            {label}
        </button>
    );
}

function GeneratedPlanPreview({ plan }: { plan: PlannerSequenceResponse }) {
    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-100">
                        {plan.class_name}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
                        {plan.schedule_based ? "Con horario real" : "Sin horario configurado"}
                    </span>
                    {plan.persisted && plan.planning_resource_title ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-100">
                            {plan.planning_resource_title}
                        </span>
                    ) : null}
                </div>
                <div className="text-slate-400">
                    {plan.occupied_slots.length > 0
                        ? `Huecos ya ocupados detectados: ${plan.occupied_slots.join(", ")}`
                        : "No se detectaron huecos ocupados para esta secuencia."}
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-800/80 text-slate-200">
                        <tr>
                            <th className="px-3 py-3 text-left">Sesión</th>
                            <th className="px-3 py-3 text-left">Fecha</th>
                            <th className="px-3 py-3 text-left">Horario</th>
                            <th className="px-3 py-3 text-left">Título</th>
                            <th className="px-3 py-3 text-left">Criterios</th>
                            <th className="px-3 py-3 text-left">Contenidos</th>
                            <th className="px-3 py-3 text-left">Recursos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plan.sessions.map((session, index) => (
                            <tr
                                key={`${session.entry_date}-${session.start_time}-${index}`}
                                className="border-t border-white/10 bg-slate-900/30 align-top"
                            >
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="font-medium text-white">{session.session_number}</div>
                                    <div className="text-xs text-slate-400">{session.phase_label}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                    <div className="text-white">{session.day_label}</div>
                                    <div className="text-xs text-slate-400">{session.entry_date}</div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap text-slate-200">
                                    {session.start_time} - {session.end_time}
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <div className="font-medium text-white">{session.title}</div>
                                    <div className="text-xs text-slate-400 mt-1">{session.focus}</div>
                                    <div className="text-xs text-cyan-100 mt-2">{session.methodology}</div>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <ul className="space-y-1 text-slate-200">
                                        {session.criteria.map((criterion) => (
                                            <li key={criterion}>• {criterion}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    <ul className="space-y-1 text-slate-200">
                                        {session.contents.map((content) => (
                                            <li key={content}>• {content}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className="px-3 py-3 min-w-[220px]">
                                    {session.resources.length > 0 ? (
                                        <ul className="space-y-1 text-slate-200">
                                            {session.resources.map((resource) => (
                                                <li key={resource}>• {resource}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-slate-500">Sin recursos específicos</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="text-sm font-medium text-white mb-2">Resumen operativo generado</div>
                <pre className="whitespace-pre-wrap text-xs text-slate-300 overflow-x-auto">
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
        <div
            className={`rounded-xl ${
                isToday ? "bg-blue-600/10 border-blue-500/30" : "bg-slate-800/30 border-white/5"
            } border p-4 min-h-[320px] md:min-h-[420px]`}
        >
            <div className="text-center mb-4">
                <div className={`text-lg font-semibold ${isToday ? "text-blue-400" : "text-white"}`}>{dayName}</div>
                <div className="text-sm text-slate-400">
                    {date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </div>
            </div>

            <div className="space-y-2">
                {entries.map((entry) => {
                    const teacherClass = getClassById(entry.class_id);
                    return (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-lg border transition-all hover:scale-[1.02]"
                            style={{
                                backgroundColor: `${entry.color || teacherClass?.color || "#3B82F6"}20`,
                                borderColor: `${entry.color || teacherClass?.color || "#3B82F6"}50`,
                            }}
                        >
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock size={12} />
                                    {entry.start_time} - {entry.end_time}
                                </div>
                                <StatusBadge status={entry.status} onStatusChange={(status) => onStatusChange(entry.id, status)} />
                            </div>
                            <div className="font-medium text-sm">{entry.title}</div>
                            {teacherClass ? (
                                <div className="text-[11px] text-cyan-100 mt-1">
                                    {teacherClass.course} · {teacherClass.group} · {teacherClass.subject}
                                </div>
                            ) : null}
                            {entry.description ? (
                                <div className="text-xs text-slate-400 mt-2 line-clamp-4 whitespace-pre-wrap">
                                    {entry.description}
                                </div>
                            ) : null}
                            {entry.resource_id ? (
                                <div className="mt-2 text-xs text-purple-300 flex items-center gap-1">
                                    <Link2 size={12} /> Recurso vinculado
                                </div>
                            ) : null}
                        </motion.div>
                    );
                })}

                {entries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm">Sin actividades</div>
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
    const statusConfig = {
        planned: { icon: Clock, color: "text-slate-400", bg: "bg-slate-600/30" },
        in_progress: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-600/30" },
        completed: { icon: Check, color: "text-green-400", bg: "bg-green-600/30" },
        cancelled: { icon: X, color: "text-red-400", bg: "bg-red-600/30" },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    const cycleStatus = () => {
        const order: PlannerEntry["status"][] = ["planned", "in_progress", "completed"];
        const currentIndex = order.indexOf(status);
        const nextIndex = (currentIndex + 1) % order.length;
        onStatusChange(order[nextIndex]);
    };

    return (
        <button
            onClick={cycleStatus}
            className={`p-1 rounded ${config.bg} ${config.color} hover:opacity-80 transition-opacity`}
            title={`Estado: ${status}`}
        >
            <Icon size={12} />
        </button>
    );
}

function SlidersHorizontalIcon() {
    return <span className="text-cyan-300"><Sparkles size={16} /></span>;
}
