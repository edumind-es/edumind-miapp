/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * ClassManager - Main page for managing teacher classes
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { NoticeBanner } from "@/components/NoticeBanner";
import { classroomService } from "@/lib/classroom-service";
import type { TeacherClass, CreateClassRequest } from "@/lib/classroom-service";

// Colores de clase: paleta desaturada de Los Cinco Mundos y señales Lámina
const COLORS = [
    "#c05f3c", "#c19a2e", "#7ba24f", "#6c8fb3",
    "#4a5f68", "#4f7a3f", "#b03a2e", "#17181a"
];

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
        <div className="min-h-screen bg-paper text-ink">
            <main className="lam-wrap py-12">
                {/* Cabecera */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10">
                    <div>
                        <p className="lam-eyebrow mb-4">EDUmind · Aula</p>
                        <h1 className="lam-h1">Mis <span className="light">clases</span></h1>
                        <p className="lam-lede mt-5">
                            Gestiona tus grupos, horarios y vincula recursos generados por IA.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link to="/planner" className="lam-btn lam-btn-ghost">
                            Planificador semanal
                        </Link>
                        <button type="button" onClick={() => setShowModal(true)} className="lam-btn">
                            Nueva clase
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
                    <div className="lam-note alert mb-6">
                        <span className="tag">Error</span>
                        <p className="m-0">{error}</p>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <span className="lam-mono animate-pulse">Cargando clases</span>
                    </div>
                )}

                {/* Estado vacío */}
                {!loading && classes.length === 0 && !error && (
                    <div className="border-t-2 border-rule pt-6 max-w-[60ch]">
                        <span className="lam-mono">Sin clases todavía</span>
                        <h2 className="text-[26px] font-bold tracking-[-0.02em] mt-2 mb-2">Crea tu primera clase</h2>
                        <p className="text-ink-2 mb-6">
                            Empieza a organizar tu docencia: grupos, horario y recursos vinculados.
                        </p>
                        <button type="button" onClick={() => setShowModal(true)} className="lam-btn">
                            Crear mi primera clase
                        </button>
                    </div>
                )}

                {/* Classes Grid */}
                {!loading && classes.length > 0 && (
                    <ul className="lam-rules">
                        {classes.map((cls) => (
                            <ClassCard key={cls.id} teacherClass={cls} />
                        ))}
                    </ul>
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
        <li className="!py-5">
            {/* El color de la clase solo aparece como filete izquierdo */}
            <span className="w-[3px] self-stretch shrink-0" style={{ background: teacherClass.color }} aria-hidden="true" />
            <div className="flex-1 min-w-0">
                <h3 className="m-0 text-[20px] font-bold">
                    <Link to={`/classroom/${teacherClass.id}`} className="no-underline hover:underline underline-offset-4">
                        {teacherClass.name}
                    </Link>
                </h3>
                <p className="m-0 mt-1 text-ink-2">{teacherClass.subject}</p>
                <p className="lam-mono mt-2">
                    {teacherClass.academic_year} · {teacherClass.student_count} alumnos
                </p>
            </div>
            <Link to={`/classroom/${teacherClass.id}`} className="lam-btn lam-btn-sm lam-btn-ghost self-center shrink-0">
                Ver
            </Link>
        </li>
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(23, 24, 26, 0.55)" }} role="dialog" aria-modal="true">
            <div className="bg-paper p-6 w-full max-w-md border-2 border-ink">
                <span className="lam-mono">Aula</span>
                <h2 className="text-[22px] font-bold leading-tight mt-2 mb-6">Nueva clase</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="lam-label">Curso</label>
                            <input
                                type="text"
                                placeholder="Ej: 3º ESO"
                                className="lam-input"
                                value={formData.course}
                                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="lam-label">Grupo</label>
                            <input
                                type="text"
                                placeholder="Ej: A"
                                className="lam-input"
                                value={formData.group}
                                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="lam-label">Materia</label>
                        <input
                            type="text"
                            placeholder="Ej: Educación Física"
                            className="lam-input"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="lam-label">Curso Escolar</label>
                            <input
                                type="text"
                                placeholder="2025-2026"
                                className="lam-input"
                                value={formData.academic_year}
                                onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="lam-label">Nº Alumnos</label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                className="lam-input"
                                value={formData.student_count}
                                onChange={(e) => setFormData({ ...formData, student_count: parseInt(e.target.value) })}
                                required
                            />
                            <p className="text-xs text-ink-3 mt-1">
                                Se generarán {formData.student_count} códigos (A01, A02...)
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="lam-label">Color</label>
                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    aria-label={`Color ${color}`}
                                    aria-pressed={formData.color === color}
                                    className="w-8 h-8 border-2 transition-colors"
                                    style={{
                                        backgroundColor: color,
                                        borderColor: formData.color === color ? 'var(--ink)' : 'transparent',
                                        outline: formData.color === color ? '2px solid var(--paper)' : 'none',
                                        outlineOffset: '-4px'
                                    }}
                                    onClick={() => setFormData({ ...formData, color })}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="lam-btn lam-btn-sm lam-btn-ghost flex-1">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="lam-btn lam-btn-sm flex-1">
                            {loading ? "Creando..." : "Crear clase"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
