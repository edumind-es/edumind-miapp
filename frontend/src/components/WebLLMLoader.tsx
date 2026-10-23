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

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Sparkles, Brain, Zap, CheckCircle, Loader2 } from "lucide-react";

interface WebLLMLoaderProps {
    progress: string;
    isComplete: boolean;
}

// Fun loading messages
const LOADING_MESSAGES = [
    { icon: Brain, text: "Despertando la inteligencia artificial...", color: "text-purple-400" },
    { icon: Cpu, text: "Procesando la magia de los chips GPU...", color: "text-blue-400" },
    { icon: Sparkles, text: "Preparando millones de parámetros...", color: "text-yellow-400" },
    { icon: Zap, text: "Cargando conocimiento educativo...", color: "text-green-400" },
    { icon: Brain, text: "Optimizando para tu dispositivo...", color: "text-pink-400" },
];

// Parse progress text from WebLLM
function parseProgress(text: string): { progress: number; stage: string; isReady: boolean } {
    // Check if model is ready (loaded from cache instantly)
    if (text.includes("finish") || text.includes("Finish") || text.includes("ready") || text.includes("Ready")) {
        return { progress: 100, stage: "ready", isReady: true };
    }

    // Match patterns like "Fetching param cache[1/22]: 16MB fetched. 3% completed"
    const percentMatch = text.match(/(\d+)%/);
    if (percentMatch) {
        const percent = parseInt(percentMatch[1]);
        if (text.toLowerCase().includes("fetch")) {
            return { progress: percent, stage: "download", isReady: false };
        }
        if (text.toLowerCase().includes("load")) {
            return { progress: percent, stage: "loading", isReady: false };
        }
        return { progress: percent, stage: "processing", isReady: false };
    }

    // Match "Loading model from cache[X/Y]" - estimate progress from X/Y ratio
    const ratioMatch = text.match(/\[(\d+)\/(\d+)\]/);
    if (ratioMatch) {
        const current = parseInt(ratioMatch[1]);
        const total = parseInt(ratioMatch[2]);
        const percent = Math.round((current / total) * 100);
        return { progress: percent, stage: "loading", isReady: false };
    }

    // Initial stage
    if (text.includes("Iniciando") || text.includes("Start") || text.includes("Initializ")) {
        return { progress: 5, stage: "init", isReady: false };
    }

    // WebGPU initialization
    if (text.includes("WebGPU") || text.includes("GPU")) {
        return { progress: 10, stage: "gpu", isReady: false };
    }

    return { progress: 0, stage: "unknown", isReady: false };
}

export function WebLLMLoader({ progress, isComplete }: WebLLMLoaderProps) {
    const [messageIndex, setMessageIndex] = useState(0);
    const [simulatedProgress, setSimulatedProgress] = useState(0);
    const parsed = parseProgress(progress);

    // Use real progress if available, otherwise simulate
    const displayProgress = parsed.progress > 0 ? parsed.progress : simulatedProgress;

    // Simulate progress for cached models (when real progress stays at 0)
    useEffect(() => {
        if (parsed.progress > 0 || parsed.isReady || isComplete) return;
        const interval = setInterval(() => {
            setSimulatedProgress((prev) => {
                if (prev >= 95) return 95; // Cap at 95% until real completion
                return prev + Math.random() * 15; // Random increment
            });
        }, 500);
        return () => clearInterval(interval);
    }, [parsed.progress, parsed.isReady, isComplete]);

    useEffect(() => {
        if (isComplete) return;
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [isComplete]);

    const currentMessage = LOADING_MESSAGES[messageIndex];
    const Icon = currentMessage.icon;

    if (isComplete || parsed.isReady) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-4 bg-green-600/20 border border-green-500/30 rounded-xl"
            >
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                    <p className="text-green-300 font-medium">¡Modelo listo!</p>
                    <p className="text-green-400/70 text-sm">La IA está funcionando en tu dispositivo 🚀</p>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-white/10 rounded-xl space-y-4"
        >
            {/* Header with animated icon */}
            <div className="flex items-center gap-3">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="p-3 bg-white/10 rounded-xl"
                >
                    <Cpu className="w-8 h-8 text-blue-400" />
                </motion.div>
                <div>
                    <h3 className="text-white font-bold text-lg">Cargando IA Local</h3>
                    <p className="text-slate-400 text-sm">Primera carga ~ 2-5 min (luego será instantáneo)</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                        {parsed.stage === "download" ? "Descargando modelo..." :
                            parsed.stage === "loading" ? "Cargando en GPU..." : "Preparando..."}
                    </span>
                    <span className="text-blue-400 font-mono">{Math.round(displayProgress)}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${displayProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Animated message */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={messageIndex}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
                >
                    <Icon className={`w-5 h-5 ${currentMessage.color}`} />
                    <span className="text-slate-300 text-sm">{currentMessage.text}</span>
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin ml-auto" />
                </motion.div>
            </AnimatePresence>

            {/* Fun facts */}
            <div className="text-xs text-slate-500 text-center pt-2 border-t border-white/5">
                💡 Tip: Una vez cargado, el modelo funciona 100% offline y sin límites
            </div>
        </motion.div>
    );
}
