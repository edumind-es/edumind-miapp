/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * ClassManager - Main page for managing teacher classes
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Plus, Users, Calendar, BookOpen,
    ChevronRight, Loader2, AlertCircle
} from "lucide-react";
import { NoticeBanner } from "@/components/NoticeBanner";
import { classroomService } from "@/lib/classroom-service";
import type { TeacherClass, CreateClassRequest } from "@/lib/classroom-service";

const COLORS = [
    "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#06B6D4", "#6366F1"
];

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function ClassManager() {
    const [classes, setClasses] = useState<TeacherClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);

    useEffect(() => {
        loadClasses();
    }, []);

    const loadClasses = async () => {
        try {
            setLoading(true);
            const data = await classroomService.getClasses();
            setClasses(data);
            setError(null);
        } catch (err) {
            setError("Error al cargar las clases. Verifica tu acceso.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Background Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative container mx-auto px-4 py-10 z-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white/50">
                            Mis Clases
                        </h1>
                        <p className="text-slate-400 mt-2">
                            Gestiona tus grupos, horarios y vincula recursos generados por IA
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            to="/planner"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <Calendar size={18} />
                            Planner Semanal
                        </Link>
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            Nueva Clase
                        </button>
                    </div>
                </div>

                {/* Error state */}
                {notice ? (
                    <NoticeBanner
                        variant={notice.variant}
                        message={notice.message}
                        className="mb-6"
                        onClose={() => setNotice(null)}
                    />
                ) : null}

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg mb-6 text-red-200">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-blue-400" size={48} />
                    </div>
                )}

                {/* Empty state */}
                {!loading && classes.length === 0 && !error && (
                    <div className="text-center py-20">
                        <BookOpen className="mx-auto text-slate-500 mb-4" size={64} />
                        <h2 className="text-2xl font-semibold mb-2">Sin clases todavía</h2>
                        <p className="text-slate-400 mb-6">
                            Crea tu primera clase para empezar a organizar tu docencia
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                        >
                            <Plus size={20} />
                            Crear mi primera clase
                        </button>
                    </div>
                )}

                {/* Classes Grid */}
                {!loading && classes.length > 0 && (
                    <motion.div
                        variants={container}
                        initial="hidden"
                        animate="show"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {classes.map((cls) => (
                            <ClassCard key={cls.id} teacherClass={cls} />
                        ))}
                    </motion.div>
                )}
            </main>

            {/* Create Class Modal */}
            {showModal && (
                <CreateClassModal
                    onNotice={setNotice}
                    onClose={() => setShowModal(false)}
                    onCreated={() => {
                        setShowModal(false);
                        loadClasses();
                    }}
                />
            )}
        </div>
    );
}

function ClassCard({ teacherClass }: { teacherClass: TeacherClass }) {
    return (
        <motion.div variants={item}>
            <Link
                to={`/classroom/${teacherClass.id}`}
                className="group block relative h-full p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:-translate-y-1"
                style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: teacherClass.color
                }}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-white group-hover:text-blue-200 transition-colors">
                            {teacherClass.name}
                        </h3>
                        <p className="text-slate-400 text-sm">{teacherClass.subject}</p>
                    </div>
                    <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ background: `${teacherClass.color}30`, color: teacherClass.color }}
                    >
                        {teacherClass.academic_year}
                    </span>
                </div>

                <div className="flex items-center gap-4 text-slate-400 text-sm">
                    <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>{teacherClass.student_count} alumnos</span>
                    </div>
                </div>

                <div className="mt-4 flex items-center text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                    Ver detalles <ChevronRight className="ml-1 w-4 h-4" />
                </div>
            </Link>
        </motion.div>
    );
}

function CreateClassModal({
    onNotice,
    onClose,
    onCreated
}: {
    onNotice: (notice: { variant: "success" | "error" | "info"; message: string } | null) => void;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateClassRequest>({
        course: "",
        group: "",
        subject: "",
        academic_year: "2025-2026",
        student_count: 25,
        color: COLORS[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await classroomService.createClass(formData);
            onNotice({ variant: "success", message: "Clase creada correctamente." });
            onCreated();
        } catch (err) {
            console.error(err);
            onNotice({ variant: "error", message: "No se pudo crear la clase." });
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
                <h2 className="text-2xl font-bold mb-6">Nueva Clase</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Curso</label>
                            <input
                                type="text"
                                placeholder="Ej: 3º ESO"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.course}
                                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Grupo</label>
                            <input
                                type="text"
                                placeholder="Ej: A"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.group}
                                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Materia</label>
                        <input
                            type="text"
                            placeholder="Ej: Educación Física"
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Curso Escolar</label>
                            <input
                                type="text"
                                placeholder="2025-2026"
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.academic_year}
                                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Nº Alumnos</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2"
                                value={formData.student_count}
                                onChange={(e) => setFormData({ ...formData, student_count: parseInt(e.target.value) })}
                                required
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Se generarán {formData.student_count} códigos (A01, A02...)
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: formData.color === color ? 'white' : 'transparent'
                                    }}
                                    onClick={() => setFormData({ ...formData, color })}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading && <Loader2 className="animate-spin" size={18} />}
                            Crear Clase
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
