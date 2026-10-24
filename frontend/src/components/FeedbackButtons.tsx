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

// Valoración de una respuesta en modo EDUmind-Lámina: botones de texto mono,
// estado seleccionado por inversión de tinta. Sin iconos ni animaciones.

import { useState } from "react";
import { authFetch } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface FeedbackButtonsProps {
    instruction: string;
    output: string;
    source: string; // "chatgpt", "edumind", "webgpu", etc.
    onFeedbackSubmitted?: () => void;
}

export function FeedbackButtons({ instruction, output, source, onFeedbackSubmitted }: FeedbackButtonsProps) {
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [feedbackType, setFeedbackType] = useState<"positive" | "negative" | null>(null);

    const handleFeedback = async (score: number, type: "positive" | "negative") => {
        if (status === "saving" || status === "success") return;

        setStatus("saving");
        setFeedbackType(type);

        try {
            const response = await authFetch("/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    instruction,
                    output,
                    source,
                    quality_score: score
                })
            });

            if (!response.ok) throw new Error("Failed to save feedback");

            setStatus("success");
            if (onFeedbackSubmitted) onFeedbackSubmitted();

            // Vuelve al estado inicial a los 3 segundos
            setTimeout(() => setStatus("idle"), 3000);

        } catch (error) {
            console.error("Feedback error:", error);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    const chip = (active: boolean) =>
        cn(
            "lam-mono px-2 py-1.5 border transition-colors duration-150",
            active ? "bg-ink !text-paper border-ink" : "border-hair !text-ink-2 hover:border-ink hover:!text-ink"
        );

    return (
        <div className="flex items-center gap-2 mt-2">
            {status === "success" ? (
                <span className="lam-mono !text-ok border border-ok px-2 py-1.5">Guardado para entrenamiento</span>
            ) : status === "error" ? (
                <span className="lam-mono !text-alert border border-alert px-2 py-1.5">Error al guardar</span>
            ) : (
                <div className="lam-seg">
                    <button
                        type="button"
                        onClick={() => handleFeedback(5, "positive")}
                        aria-pressed={feedbackType === "positive"}
                        title="Buena respuesta (guardar)"
                        className={chip(feedbackType === "positive")}
                    >
                        Útil
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFeedback(1, "negative")}
                        aria-pressed={feedbackType === "negative"}
                        title="Mala respuesta"
                        className={chip(feedbackType === "negative")}
                    >
                        Mejorable
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFeedback(5, "positive")}
                        title="Guardar explícitamente"
                        className={chip(false)}
                    >
                        Guardar
                    </button>
                </div>
            )}
        </div>
    );
}
