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

// Indicador de generación en servidor en modo EDUmind-Lámina: panel con filete,
// barra de progreso de 4px y consejos en texto. Sin iconos ni animación.

import { useEffect, useState } from "react";

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
        <div className="lam-panel space-y-4">
            <div className="lam-panel-head">
                <span className="lam-mono lam-mono-ink">
                    {modelType === "quality" ? "EDUmind · modo calidad" : "EDUmind · modo ágil"}
                </span>
                <span className="lam-mono">
                    {remaining > 0 ? `~${formatTime(remaining)} restante` : "Casi listo"}
                </span>
            </div>

            <p className="m-0 text-ink-2 text-sm">
                {modelType === "quality"
                    ? "Preparando una respuesta más cuidada y estructurada."
                    : `Procesando${taskType ? ` ${taskType}` : ""}.`}
            </p>

            {/* Barra de progreso: rectángulo de 4px */}
            <div className="space-y-2">
                <div
                    className="lam-progress"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <i style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between">
                    <span className="lam-mono">Transcurrido {formatTime(elapsed)}</span>
                    <span className="lam-mono lam-mono-ink">{Math.round(progress)} %</span>
                </div>
            </div>

            {/* Consejo rotatorio */}
            <div key={tip} className="flex items-start gap-3 py-2 border-t border-hair">
                <span className="text-ink-3">—</span>
                <span className="text-sm text-ink-2">{tips[tip]}</span>
            </div>

            {modelType === "quality" && (
                <p className="m-0 lam-mono pt-2 border-t border-hair">
                    Se usa el motor disponible más estable para esta solicitud
                </p>
            )}
        </div>
    );
}
