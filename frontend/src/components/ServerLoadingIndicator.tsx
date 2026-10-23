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

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Cpu, Sparkles, Loader2 } from "lucide-react";

interface ServerLoadingProps {
    isLoading: boolean;
    estimatedSeconds: number;
    modelType: "fast" | "quality";
    taskType?: string;
}

export function ServerLoadingIndicator({
    isLoading,
    estimatedSeconds,
    modelType,
    taskType
}: ServerLoadingProps) {
    const [elapsed, setElapsed] = useState(0);
    const [tip, setTip] = useState(0);

    const tips = [
        "EDUmind organiza la respuesta para que puedas revisarla y reutilizarla rápido.",
        "El sistema prioriza coherencia pedagógica y claridad antes de devolver el texto.",
        "Cuando el contexto es ambiguo, la app intenta explicitar límites y supuestos.",
        "Podrás revisar, editar y exportar el resultado en cuanto termine la generación.",
        "Si el servicio tarda más de lo esperado, puedes cancelar y volver a intentarlo.",
    ] as const;

    useEffect(() => {
        if (!isLoading) return;
        const timer = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);

        const tipTimer = setInterval(() => {
            setTip((prev) => (prev + 1) % tips.length);
        }, 5000);

        return () => {
            clearInterval(timer);
            clearInterval(tipTimer);
        };
    }, [isLoading, tips.length]);

    if (!isLoading) return null;

    const progress = Math.min((elapsed / estimatedSeconds) * 100, 95);
    const remaining = Math.max(estimatedSeconds - elapsed, 0);

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-white/10 rounded-xl space-y-4"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl"
                    >
                        {modelType === "quality" ? (
                            <Sparkles className="w-6 h-6 text-purple-400" />
                        ) : (
                            <Cpu className="w-6 h-6 text-blue-400" />
                        )}
                    </motion.div>
                    <div>
                        <h3 className="text-white font-bold">
                            {modelType === "quality" ? "EDUmind en modo calidad" : "EDUmind en modo ágil"}
                        </h3>
                        <p className="text-slate-400 text-sm">
                            {modelType === "quality"
                                ? "Preparando una respuesta más cuidada y estructurada..."
                                : `Procesando${taskType ? ` ${taskType}` : ""}...`}
                        </p>
                    </div>
                </div>

                {/* Time indicator */}
                <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono text-sm">
                        {remaining > 0 ? `~${formatTime(remaining)} restante` : "Casi listo..."}
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${modelType === "quality"
                            ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"
                            : "bg-gradient-to-r from-blue-500 to-cyan-500"
                            }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                    <span>Tiempo transcurrido: {formatTime(elapsed)}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
            </div>

            {/* Animated tip carousel */}
            <motion.div
                key={tip}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-white/5 rounded-lg"
            >
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-slate-300">{tips[tip]}</span>
            </motion.div>

            {/* Quality model explanation */}
            {modelType === "quality" && (
                <div className="text-xs text-slate-500 text-center border-t border-white/5 pt-3">
                    La app está usando el motor disponible más estable para esta solicitud.
                </div>
            )}
        </motion.div>
    );
}
