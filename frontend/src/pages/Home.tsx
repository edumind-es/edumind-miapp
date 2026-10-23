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
import { BookOpen, GraduationCap, School, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none" />

            <main className="relative container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-screen z-10">

                <motion.div
                    className="text-center mb-16 space-y-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-4">
                        <span className="text-sm font-medium text-blue-300">Inteligencia Artificial Educativa</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white/50 pb-2">
                        EDUMind MiApp
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light">
                        Plataforma profesional para generar recursos, preparar oposiciones y gestionar centros con la potencia de múltiples IAs.
                    </p>
                </motion.div>

                <motion.div
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl"
                >
                    <RoleCard
                        to="/dashboard?role=docente"
                        icon={<BookOpen className="w-8 h-8 text-emerald-400" />}
                        title="Docentes"
                        description="Genera situaciones de aprendizaje, rúbricas y materiales didácticos adaptados."
                        color="hover:border-emerald-500/50 hover:shadow-emerald-500/20"
                    />
                    <RoleCard
                        to="/dashboard?role=opositor"
                        icon={<GraduationCap className="w-8 h-8 text-blue-400" />}
                        title="Opositores"
                        description="Entrena supuestos prácticos, programación y defensa con feedback experto."
                        color="hover:border-blue-500/50 hover:shadow-blue-500/20"
                    />
                    <RoleCard
                        to="/dashboard?role=centro"
                        icon={<School className="w-8 h-8 text-purple-400" />}
                        title="Centros"
                        description="Gestión directiva, proyectos de centro y documentación administrativa."
                        color="hover:border-purple-500/50 hover:shadow-purple-500/20"
                    />
                </motion.div>

                {/* Chat Button CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12"
                >
                    <Link
                        to="/chat"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl text-white font-semibold text-lg shadow-2xl shadow-blue-500/25 transition-all duration-300 hover:scale-105"
                    >
                        💬 Iniciar Chat con IA
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </motion.div>
            </main>
        </div>
    );
}

interface RoleCardProps {
    to: string;
    icon: ReactNode;
    title: string;
    description: string;
    color: string;
}

function RoleCard({ to, icon, title, description, color }: RoleCardProps) {
    return (
        <motion.div variants={item}>
            <Link to={to} className={`group block relative h-full p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all duration-300 ${color} hover:-translate-y-1`}>
                <div className="mb-4 bg-white/5 p-3 rounded-xl inline-block w-fit group-hover:bg-white/10 transition-colors">
                    {icon}
                </div>
                <h3 className="text-2xl font-semibold mb-3 text-white group-hover:text-blue-200 transition-colors">{title}</h3>
                <p className="text-slate-400 leading-relaxed mb-6">
                    {description}
                </p>
                <div className="flex items-center text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                    Comenzar <ArrowRight className="ml-2 w-4 h-4" />
                </div>
            </Link>
        </motion.div>
    );
}
