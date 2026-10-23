/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * ClassDetail - View and manage a specific class
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowLeft, Users, Calendar, Clock, FileText,
    Plus, Trash2, Loader2, Printer, Download, BookOpen
} from "lucide-react";
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
    const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'students' | 'resources'>('info');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [classData, scheduleData, studentsData, resourcesData] = await Promise.all([
                classroomService.getClass(classId),
                classroomService.getSchedule(classId),
                classroomService.getStudents(classId),
                resourceService.getResourcesByClass(classId)
            ]);
            setTeacherClass(classData);
            setSchedule(scheduleData);
            setStudents(studentsData);
            setResources(resourcesData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [classId]);

    useEffect(() => {
        if (classId) {
            void loadData();
        }
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
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #1e40af; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #f3f4f6; }
                    .header { margin-bottom: 20px; }
                    .code { font-weight: bold; font-size: 1.2em; }
                    .name-field { border-bottom: 1px solid #000; min-width: 200px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${escapeHtml(teacherClass.name)}</h1>
                    <p><strong>Materia:</strong> ${escapeHtml(teacherClass.subject)}</p>
                    <p><strong>Curso escolar:</strong> ${escapeHtml(teacherClass.academic_year)}</p>
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
                <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
                    Documento generado por EDUmind MiApp - Este documento es confidencial.
                    La asociación de nombres a códigos debe realizarse en papel.
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
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-400" size={48} />
            </div>
        );
    }

    if (!teacherClass) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
                <h1 className="text-2xl mb-4">Clase no encontrada</h1>
                <Link to="/classroom" className="text-blue-400 hover:underline">
                    Volver a mis clases
                </Link>
            </div>
        );
    }

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

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Link
                        to="/classroom"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold" style={{ color: teacherClass.color }}>
                            {teacherClass.name}
                        </h1>
                        <p className="text-slate-400">{teacherClass.subject} • {teacherClass.academic_year}</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-sm">
                            <Users size={14} />
                            {teacherClass.student_count} alumnos
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
                    {(['info', 'schedule', 'students', 'resources'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-t-lg transition-colors ${activeTab === tab
                                ? 'bg-white/10 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tab === 'info' && 'Información'}
                            {tab === 'schedule' && 'Horario'}
                            {tab === 'students' && 'Alumnado'}
                            {tab === 'resources' && 'Recursos IA'}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-800/50 rounded-xl p-6 border border-white/10"
                >
                    {activeTab === 'info' && (
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Datos de la Clase</h3>
                                <dl className="space-y-3">
                                    <div className="flex justify-between">
                                        <dt className="text-slate-400">Curso:</dt>
                                        <dd>{teacherClass.course}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-400">Grupo:</dt>
                                        <dd>{teacherClass.group}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-400">Materia:</dt>
                                        <dd>{teacherClass.subject}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-400">Año académico:</dt>
                                        <dd>{teacherClass.academic_year}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-slate-400">Nº Alumnos:</dt>
                                        <dd>{teacherClass.student_count}</dd>
                                    </div>
                                </dl>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
                                <div className="space-y-2">
                                    <Link
                                        to="/planner"
                                        className="flex items-center gap-2 p-3 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg transition-colors"
                                    >
                                        <Calendar size={18} />
                                        Ver en el Planner
                                    </Link>
                                    <button
                                        onClick={handlePrintStudentList}
                                        className="flex items-center gap-2 p-3 bg-green-600/20 hover:bg-green-600/30 rounded-lg transition-colors w-full text-left"
                                    >
                                        <Printer size={18} />
                                        Imprimir lista de alumnos
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold">Horario Semanal</h3>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm"
                                >
                                    <Plus size={16} />
                                    Añadir Horario
                                </button>
                            </div>

                            {schedule.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <Clock size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Sin horarios configurados</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {schedule.map((slot) => (
                                        <div
                                            key={slot.id}
                                            className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="font-semibold" style={{ color: teacherClass.color }}>
                                                    {DAYS[slot.day_of_week]}
                                                </div>
                                                <div className="text-slate-400">
                                                    {slot.start_time} - {slot.end_time}
                                                </div>
                                                {slot.room && (
                                                    <div className="text-sm text-slate-500">
                                                        Aula: {slot.room}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setScheduleToDelete(slot.id)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'students' && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold">Códigos de Alumnos</h3>
                                <button
                                    onClick={handlePrintStudentList}
                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm"
                                >
                                    <Download size={16} />
                                    Imprimir listado
                                </button>
                            </div>

                            <p className="text-slate-400 text-sm mb-4">
                                Los códigos son anónimos. Usa el documento imprimible para asociar nombres en papel.
                            </p>

                            <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
                                {students.map((student) => (
                                    <div
                                        key={student.id}
                                        className="p-3 bg-white/5 rounded-lg text-center"
                                        style={{ borderLeft: `3px solid ${teacherClass.color}` }}
                                    >
                                        <div className="font-bold">{student.code}</div>
                                        <div className="text-xs text-slate-500">Alumno {student.number}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'resources' && (
                        <div>
                            <h3 className="text-lg font-semibold mb-6">Recursos IA Vinculados</h3>

                            {resources.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                                    <p>Sin recursos vinculados</p>
                                    <p className="text-sm mt-2">
                                        Genera rúbricas, sesiones o planificaciones y vincúlalas aquí
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {resources.map((resource) => (
                                        <div
                                            key={resource.id}
                                            className="p-4 bg-white/5 rounded-lg flex items-center gap-4"
                                        >
                                            <div className="p-2 bg-purple-500/20 rounded">
                                                <FileText size={20} className="text-purple-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">{resource.title}</div>
                                                <div className="text-sm text-slate-400 capitalize">
                                                    {resource.resource_type}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Add Schedule Modal */}
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10"
            >
                <h2 className="text-xl font-bold mb-4">Añadir Horario</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Día de la semana</label>
                        <select
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
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
                            <label className="block text-sm text-slate-400 mb-1">Hora inicio</label>
                            <input
                                type="time"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Hora fin</label>
                            <input
                                type="time"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Aula (opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Gimnasio"
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                            value={formData.room || ""}
                            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 border border-white/10 rounded-lg hover:bg-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={18} />}
                            Añadir
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
