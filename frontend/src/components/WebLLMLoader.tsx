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

// Carga del modelo local (WebGPU) en modo EDUmind-Lámina: panel con filete,
// barra de progreso de 4px y mensajes en texto. Sin iconos, emoji ni animación.

import { useState, useEffect } from "react";

interface WebLLMLoaderProps {
    progress: string;
    isComplete: boolean;
}

// Mensajes rotatorios durante la carga
const LOADING_MESSAGES = [
    "Iniciando el modelo en tu dispositivo",
    "Reservando memoria en la GPU",
    "Preparando millones de parámetros",
    "Cargando conocimiento educativo",
    "Optimizando para tu dispositivo",
];

// Interpreta el texto de progreso que emite WebLLM
function parseProgress(text: string): { progress: number; stage: string; isReady: boolean } {
    // Modelo listo (p. ej. cargado desde caché al instante)
    if (text.includes("finish") || text.includes("Finish") || text.includes("ready") || text.includes("Ready")) {
        return { progress: 100, stage: "ready", isReady: true };
    }

    // Patrones como "Fetching param cache[1/22]: 16MB fetched. 3% completed"
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

    // "Loading model from cache[X/Y]": estima el progreso a partir de X/Y
    const ratioMatch = text.match(/\[(\d+)\/(\d+)\]/);
    if (ratioMatch) {
        const current = parseInt(ratioMatch[1]);
        const total = parseInt(ratioMatch[2]);
        const percent = Math.round((current / total) * 100);
        return { progress: percent, stage: "loading", isReady: false };
    }

    // Fase inicial
    if (text.includes("Iniciando") || text.includes("Start") || text.includes("Initializ")) {
        return { progress: 5, stage: "init", isReady: false };
    }

    // Inicialización de WebGPU
    if (text.includes("WebGPU") || text.includes("GPU")) {
        return { progress: 10, stage: "gpu", isReady: false };
    }

    return { progress: 0, stage: "unknown", isReady: false };
}

export function WebLLMLoader({ progress, isComplete }: WebLLMLoaderProps) {
    const [messageIndex, setMessageIndex] = useState(0);
    const [simulatedProgress, setSimulatedProgress] = useState(0);
    const parsed = parseProgress(progress);

    // Usa el progreso real si existe; si no, lo simula
    const displayProgress = parsed.progress > 0 ? parsed.progress : simulatedProgress;

    // Simula progreso para modelos en caché (cuando el real se queda en 0)
    useEffect(() => {
        if (parsed.progress > 0 || parsed.isReady || isComplete) return;
        const interval = setInterval(() => {
            setSimulatedProgress((prev) => {
                if (prev >= 95) return 95; // Tope del 95 % hasta la finalización real
                return prev + Math.random() * 15;
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

    if (isComplete || parsed.isReady) {
        return (
            <div className="lam-note ok">
                <span className="tag">Modelo listo</span>
                <p className="m-0 text-ink">La IA está funcionando en tu dispositivo, sin conexión y sin límites.</p>
            </div>
        );
    }

    const stageLabel =
        parsed.stage === "download" ? "Descargando modelo" :
            parsed.stage === "loading" ? "Cargando en GPU" : "Preparando";

    return (
        <div className="lam-panel space-y-4">
            <div className="lam-panel-head">
                <span className="lam-mono lam-mono-ink">Cargando IA local</span>
                <span className="lam-mono">{Math.round(displayProgress)} %</span>
            </div>

            <p className="m-0 text-ink-2 text-sm">Primera carga de 2 a 5 minutos; después será instantáneo.</p>

            {/* Barra de progreso: rectángulo de 4px */}
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="lam-mono">{stageLabel}</span>
                    <span className="lam-mono lam-mono-ink">{Math.round(displayProgress)} %</span>
                </div>
                <div
                    className="lam-progress"
                    role="progressbar"
                    aria-valuenow={Math.round(displayProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <i style={{ width: `${displayProgress}%` }} />
                </div>
            </div>

            {/* Mensaje rotatorio */}
            <div key={messageIndex} className="flex items-center gap-3 py-2 border-t border-hair">
                <span className="text-ink-3">—</span>
                <span className="text-ink-2 text-sm">{LOADING_MESSAGES[messageIndex]}</span>
            </div>

            <p className="m-0 lam-mono pt-2 border-t border-hair">
                Una vez cargado, el modelo funciona sin conexión y sin límites
            </p>
        </div>
    );
}
