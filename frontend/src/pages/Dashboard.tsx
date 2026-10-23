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

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, FileText, PenTool, Layout, Users, ClipboardCheck } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

const TOOLS = {
    docente: [
        { id: "planning", title: "Planificación Semanal", icon: Layout, desc: "Construye sesiones fechadas con criterios, DUA y recursos reales de aula.", color: "text-emerald-400 bg-emerald-400/10", link: "/tools/planning" },
        { id: "situation", title: "Situación de Aprendizaje", icon: BookOpen, desc: "Crea situaciones de aprendizaje LOMLOE.", color: "text-blue-400 bg-blue-400/10", link: "/tools/situation" },
        { id: "stem", title: "Proyectos STEM", icon: PenTool, desc: "Diseña proyectos Maker y Polos Creativos.", color: "text-purple-400 bg-purple-400/10", link: "/tools/stem" },
        { id: "diversity", title: "Plan de Inclusión", icon: Users, desc: "Intervención para NEAE y diversidad.", color: "text-pink-400 bg-pink-400/10", link: "/tools/diversity" },
        { id: "reinforcement_plan", title: "Plan de Refuerzo", icon: ClipboardCheck, desc: "Plan de refuerzo anonimo con base curricular de Galicia.", color: "text-cyan-400 bg-cyan-400/10", link: "/tools/reinforcement_plan" },
        { id: "session", title: "Diseño de Sesiones", icon: ClipboardCheck, desc: "Planificación detallada sesión a sesión.", color: "text-orange-400 bg-orange-400/10", link: "/tools/session" },
    ],
    opositor: [
        { id: "case", title: "Supuestos Prácticos", icon: FileText, desc: "Entrenamiento y resolución de casos.", color: "text-blue-400 bg-blue-400/10", link: "/tools/case" },
        { id: "topic", title: "Desarrollo de Temas", icon: BookOpen, desc: "Generación de temas de estudio.", color: "text-emerald-400 bg-emerald-400/10", link: "/tools/topic" },
        { id: "defense", title: "Defensa Oral", icon: Users, desc: "Preparación de la defensa y debate.", color: "text-pink-400 bg-pink-400/10", link: "/tools/defense" },
        { id: "idea", title: "Mentor / Lluvia de Ideas", icon: Layout, desc: "Consultas creativas para tu oposición.", color: "text-cyan-400 bg-cyan-400/10", link: "/tools/idea" },
    ],
    centro: [
        { id: "minutes", title: "Actas de Reunión", icon: ClipboardCheck, desc: "Redacción formal de actas (Claustro, CCP...).", color: "text-yellow-400 bg-yellow-400/10", link: "/tools/minutes" },
        { id: "institution_doc", title: "Documentación Institucional", icon: FileText, desc: "PGA, RRI, Planes de Centro...", color: "text-purple-400 bg-purple-400/10", link: "/tools/institution_doc" },
        { id: "inspection_report", title: "Inspección Educativa", icon: FileText, desc: "Informes, actas y respuestas técnicas para requerimientos de inspección.", color: "text-amber-400 bg-amber-400/10", link: "/tools/inspection_report" },
        { id: "reinforcement_plan", title: "Plan de Refuerzo", icon: Users, desc: "Plan de refuerzo por area con enfoque privacy-first y seguimiento.", color: "text-cyan-400 bg-cyan-400/10", link: "/tools/reinforcement_plan" },
        { id: "normativa", title: "Aplicación Normativa", icon: BookOpen, desc: "Consultas legales sobre convivencia (Galicia).", color: "text-red-400 bg-red-400/10", link: "/tools/normativa" },
    ]
};

const ROLE_TO_TOOLS_KEY: Record<string, keyof typeof TOOLS> = {
    docente: "docente",
    teacher_premium: "docente",
    admin: "docente",
    opositor: "opositor",
    centro: "centro",
};

const ROLE_LABELS: Record<string, string> = {
    docente: "Docente",
    teacher_premium: "Docente Premium",
    admin: "Administrador",
    opositor: "Opositor",
    centro: "Centro",
};

export default function Dashboard() {
    const { user } = useAuthSession();
    const sessionRole = user?.role ?? "";
    const toolsKey = ROLE_TO_TOOLS_KEY[sessionRole] ?? "docente";
    const tools = TOOLS[toolsKey];
    const roleLabel = ROLE_LABELS[sessionRole] ?? "Usuario";

    return (
        <div className="min-h-screen bg-[#0f1117] p-8 text-white">
            <div className="max-w-6xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-3xl font-bold mb-2">
                        {user ? `Panel de ${roleLabel}` : "Panel EDUmind"}
                    </h1>
                    {user && (
                        <p className="text-slate-500 text-sm mb-1">
                            Conectado como <span className="text-slate-300 font-medium">{user.username}</span>
                        </p>
                    )}
                    <p className="text-slate-400">Selecciona una herramienta para comenzar a generar contenido.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.map((tool) => (
                        <Link key={tool.id} to={tool.link}>
                            <motion.div
                                whileHover={{ y: -5 }}
                                className="bg-[#1a1f2e] border border-white/5 p-6 rounded-2xl hover:border-white/20 transition-all cursor-pointer group"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tool.color} group-hover:scale-110 transition-transform`}>
                                    <tool.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold mb-2">{tool.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{tool.desc}</p>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
