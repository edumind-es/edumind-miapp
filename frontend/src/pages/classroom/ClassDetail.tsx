/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * ClassDetail - View and manage a specific class
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { NoticeBanner } from "@/components/NoticeBanner";
import {
    classroomService, resourceService
} from "@/lib/classroom-service";
import type {
    TeacherClass, ClassSchedule, StudentCode, GeneratedResource,
    CreateScheduleRequest
} from "@/lib/classroom-service";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export default function ClassDetail() {
    const { id } = useParams<{ id: string }>();
    const classId = parseInt(id || "0");

    const [teacherClass, setTeacherClass] = useState<TeacherClass | null>(null);
    const [schedule, setSchedule] = useState<ClassSchedule[]>([]);
    const [students, setStudents] = useState<StudentCode[]>([]);
    const [resources, setResources] = useState<GeneratedResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'students' | 'resources'>('info');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);

    const loadData = useCallback(async (isActive: () => boolean = () => true) => {
        setLoading(true);
        setLoadError(null);
        try {
            const [classData, scheduleData, studentsData, resourcesData] = await Promise.all([
                classroomService.getClass(classId),
                classroomService.getSchedule(classId),
                classroomService.getStudents(classId),
                resourceService.getResourcesByClass(classId)
            ]);
            if (!isActive()) return;
            setTeacherClass(classData);
            setSchedule(scheduleData);
            setStudents(studentsData);
            setResources(resourcesData);
        } catch (err) {
            if (!isActive()) return;
            console.error(err);
            // F-08: un fallo de red o del servidor no es "clase no encontrada".
            const status = (err as { response?: { status?: number } })?.response?.status;
            setLoadError(
                status === 404 ? null : "No se pudo cargar la clase. Comprueba la conexión e inténtalo de nuevo."
            );
        } finally {
            if (isActive()) setLoading(false);
        }
    }, [classId]);

    // F-04: si el componente se desmonta antes de que responda el servidor, no se toca el estado.
    useEffect(() => {
        if (!classId) return;
        let active = true;
        void loadData(() => active);
        return () => {
            active = false;
        };
    }, [classId, loadData]);

    const handleDeleteSchedule = async () => {
        if (!scheduleToDelete) return;
        try {
            await classroomService.deleteScheduleSlot(classId, scheduleToDelete);
            setSchedule(schedule.filter(s => s.id !== scheduleToDelete));
            setNotice({ variant: "success", message: "Horario eliminado correctamente." });
        } catch (err) {
            console.error(err);
            setNotice({ variant: "error", message: "No se pudo eliminar el horario." });
        } finally {
            setScheduleToDelete(null);
        }
    };

    const handlePrintStudentList = () => {
        if (!teacherClass) return;

        const printContent = `
            <html>
            <head>
                <title>Lista de Alumnos - ${escapeHtml(teacherClass.name)}</title>
                <style>
                    /* Impresión en modo EDUmind-Lámina: papel, tinta y filetes */
                    body { font-family: Archivo, Arial, sans-serif; color: #17181a; padding: 24px; }
                    h1 { font-weight: 800; letter-spacing: -0.02em; margin: 0 0 8px; }
                    .meta { font-family: "JetBrains Mono", monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: #5c5a55; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border-bottom: 1px solid #c9c4b8; padding: 12px; text-align: left; }
                    th { background: #17181a; color: #ece9e1; font-family: "JetBrains Mono", monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; }
                    .header { margin-bottom: 20px; border-bottom: 2px solid #17181a; padding-bottom: 12px; }
                    .code { font-weight: bold; font-size: 1.2em; }
                    .name-field { min-width: 200px; }
                    .pie { margin-top: 30px; font-size: 0.85em; color: #5c5a55; border-top: 2px solid #17181a; padding-top: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${escapeHtml(teacherClass.name)}</h1>
                    <p class="meta">Materia · ${escapeHtml(teacherClass.subject)} · Curso ${escapeHtml(teacherClass.academic_year)}</p>
                </div>
                <table>
                    <tr>
                        <th>Código</th>
                        <th>Nombre del Alumno (rellenar en papel)</th>
                    </tr>
                    ${students.map(s => `
                        <tr>
                            <td class="code">${escapeHtml(s.code)}</td>
                            <td class="name-field"></td>
                        </tr>
                    `).join('')}
                </table>
                <p class="pie">
                    EDUmind® · Luis Vilela Acuña · MiApp. Documento confidencial:
                    la asociación de nombres a códigos debe realizarse en papel.
                </p>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center">
                <span className="lam-mono animate-pulse">Cargando clase</span>
            </div>
        );
    }

    if (!teacherClass) {
        return (
            <div className="min-h-screen bg-paper flex flex-col items-center justify-center text-ink">
                <h1 className="text-[26px] font-bold mb-4">{loadError ? "No se pudo cargar la clase" : "Clase no encontrada"}</h1>
                {loadError ? (
                    <>
                        <p className="text-ink-2 mb-4">{loadError}</p>
                        <button type="button" className="lam-btn lam-btn-sm mb-3" onClick={() => void loadData()}>
                            Reintentar
                        </button>
                    </>
                ) : null}
                <Link to="/classroom" className="lam-btn lam-btn-sm lam-btn-ghost">
                    Volver a mis clases
                </Link>
            </div>
        );
    }

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

                {/* Cabecera: el color de la clase solo como filete izquierdo */}
                <Link to="/classroom" className="lam-mono lam-mono-ink inline-block mb-5 hover:underline underline-offset-4">
                    ← Mis clases
                </Link>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pl-5 border-l-[3px]" style={{ borderLeftColor: teacherClass.color }}>
                    <div>
                        <p className="lam-eyebrow mb-3">EDUmind · Aula</p>
                        <h1 className="m-0 text-[32px] font-extrabold tracking-[-0.03em] leading-none">
                            {teacherClass.name}
                        </h1>
                        <p className="text-ink-2 mt-3">{teacherClass.subject} · {teacherClass.academic_year}</p>
                    </div>
                    <span className="lam-mono lam-mono-ink">{teacherClass.student_count} alumnos</span>
                </div>

                {/* Pestañas: estado activo por inversión de tinta */}
                <div className="lam-seg mb-6 flex-wrap">
                    {(['info', 'schedule', 'students', 'resources'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            aria-pressed={activeTab === tab}
                        >
                            {tab === 'info' && 'Información'}
                            {tab === 'schedule' && 'Horario'}
                            {tab === 'students' && 'Alumnado'}
                            {tab === 'resources' && 'Recursos IA'}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div key={activeTab} className="bg-card p-6 border border-hair">
                    {activeTab === 'info' && (
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="lam-mono mb-2">Datos de la clase</h3>
                                <dl className="lam-spec">
                                    <div><dt>Curso</dt><dd>{teacherClass.course}</dd></div>
                                    <div><dt>Grupo</dt><dd>{teacherClass.group}</dd></div>
                                    <div><dt>Materia</dt><dd>{teacherClass.subject}</dd></div>
                                    <div><dt>Año académico</dt><dd>{teacherClass.academic_year}</dd></div>
                                    <div><dt>Nº de alumnos</dt><dd>{teacherClass.student_count}</dd></div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="lam-mono mb-4">Acciones rápidas</h3>
                                <div className="flex flex-col gap-3">
                                    <Link to="/planner" className="lam-btn lam-btn-ghost lam-btn-block">
                                        Ver en el planificador
                                    </Link>
                                    <button type="button" onClick={handlePrintStudentList} className="lam-btn lam-btn-ghost lam-btn-block">
                                        Imprimir lista de alumnos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="lam-mono m-0">Horario semanal</h3>
                                <button type="button" onClick={() => setShowScheduleModal(true)} className="lam-btn lam-btn-sm">
                                    Añadir horario
                                </button>
                            </div>

                            {schedule.length === 0 ? (
                                <p className="text-ink-3 py-6 border-t border-hair">Sin horarios configurados.</p>
                            ) : (
                                <ul className="lam-rules">
                                    {schedule.map((slot) => (
                                        <li key={slot.id} className="items-center">
                                            <span className="w-[3px] self-stretch shrink-0" style={{ background: teacherClass.color }} aria-hidden="true" />
                                            <span className="font-semibold w-28">{DAYS[slot.day_of_week]}</span>
                                            <span className="font-mono text-[13px] text-ink-2">
                                                {slot.start_time} – {slot.end_time}
                                            </span>
                                            {slot.room && (
                                                <span className="lam-mono">Aula {slot.room}</span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setScheduleToDelete(slot.id)}
                                                className="ml-auto lam-mono !text-alert hover:underline underline-offset-4"
                                            >
                                                Eliminar
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {activeTab === 'students' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="lam-mono m-0">Códigos de alumnos</h3>
                                <button type="button" onClick={handlePrintStudentList} className="lam-btn lam-btn-sm">
                                    Imprimir listado
                                </button>
                            </div>

                            <p className="text-ink-2 text-sm mb-4">
                                Los códigos son anónimos. Usa el documento imprimible para asociar nombres en papel.
                            </p>

                            <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                                {students.map((student) => (
                                    <div
                                        key={student.id}
                                        className="p-3 bg-paper border border-hair text-center"
                                        style={{ borderLeft: `3px solid ${teacherClass.color}` }}
                                    >
                                        <div className="font-mono font-medium">{student.code}</div>
                                        <div className="lam-mono mt-1">Nº {student.number}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'resources' && (
                        <div>
                            <h3 className="lam-mono mb-4">Recursos IA vinculados</h3>

                            {resources.length === 0 ? (
                                <div className="py-6 border-t border-hair text-ink-3">
                                    <p className="m-0">Sin recursos vinculados.</p>
                                    <p className="m-0 mt-2 text-sm">
                                        Genera rúbricas, sesiones o planificaciones y vincúlalas aquí.
                                    </p>
                                </div>
                            ) : (
                                <ul className="lam-rules">
                                    {resources.map((resource) => (
                                        <li key={resource.id} className="items-center">
                                            <span className="dash">—</span>
                                            <div className="flex-1">
                                                <div className="font-medium">{resource.title}</div>
                                                <div className="lam-mono mt-1">{resource.resource_type}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de nuevo tramo horario */}
            {showScheduleModal && (
                <AddScheduleModal
                    classId={classId}
                    onNotice={setNotice}
                    onClose={() => setShowScheduleModal(false)}
                    onAdded={() => {
                        setShowScheduleModal(false);
                        loadData();
                    }}
                />
            )}
            <ConfirmationDialog
                open={scheduleToDelete !== null}
                title="Eliminar horario"
                description="Se eliminará este tramo horario de la clase actual. Podrás volver a crearlo después si lo necesitas."
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => void handleDeleteSchedule()}
                onCancel={() => setScheduleToDelete(null)}
            />
        </div>
    );
}

function AddScheduleModal({
    classId,
    onNotice,
    onClose,
    onAdded
}: {
    classId: number;
    onNotice: (notice: { variant: "success" | "error" | "info"; message: string } | null) => void;
    onClose: () => void;
    onAdded: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateScheduleRequest>({
        day_of_week: 0,
        start_time: "09:00",
        end_time: "09:55",
        room: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await classroomService.addScheduleSlot(classId, formData);
            onNotice({ variant: "success", message: "Horario añadido correctamente." });
            onAdded();
        } catch (err) {
            console.error(err);
            onNotice({ variant: "error", message: "No se pudo añadir el horario." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(23, 24, 26, 0.55)" }} role="dialog" aria-modal="true">
            <div className="bg-paper p-6 w-full max-w-md border-2 border-ink">
                <span className="lam-mono">Horario</span>
                <h2 className="text-[22px] font-bold leading-tight mt-2 mb-5">Añadir tramo horario</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="lam-label">Día de la semana</label>
                        <select
                            className="lam-input"
                            value={formData.day_of_week}
                            onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                        >
                            {DAYS.map((day, i) => (
                                <option key={i} value={i}>{day}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="lam-label">Hora inicio</label>
                            <input
                                type="time"
                                className="lam-input"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="lam-label">Hora fin</label>
                            <input
                                type="time"
                                className="lam-input"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="lam-label">Aula (opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Gimnasio"
                            className="lam-input"
                            value={formData.room || ""}
                            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="lam-btn lam-btn-sm lam-btn-ghost flex-1">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="lam-btn lam-btn-sm flex-1">
                            {loading ? "Guardando..." : "Añadir"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
