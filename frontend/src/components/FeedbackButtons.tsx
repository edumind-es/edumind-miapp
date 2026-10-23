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

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Save, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/lib/auth-client";

interface FeedbackButtonsProps {
    instruction: string;
    output: string;
    source: string; // "deepseek", "edumind", "webgpu", etc.
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

            // Reset after 3 seconds
            setTimeout(() => setStatus("idle"), 3000);

        } catch (error) {
            console.error("Feedback error:", error);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-2">
            <AnimatePresence mode="wait">
                {status === "success" ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1.5 text-green-400 text-xs font-medium px-2 py-1 bg-green-500/10 rounded-md"
                    >
                        <Check className="w-3 h-3" />
                        <span>¡Guardado para entrenamiento!</span>
                    </motion.div>
                ) : status === "error" ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1.5 text-red-400 text-xs font-medium px-2 py-1 bg-red-500/10 rounded-md"
                    >
                        <AlertCircle className="w-3 h-3" />
                        <span>Error al guardar</span>
                    </motion.div>
                ) : (
                    <div className="flex items-center gap-1">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleFeedback(5, "positive")}
                            className={`p-1.5 rounded-md transition-colors ${feedbackType === "positive" ? "text-green-400 bg-green-500/10" : "text-slate-500 hover:text-green-400 hover:bg-white/5"
                                }`}
                            title="Buena respuesta (Guardar)"
                        >
                            <ThumbsUp className="w-3.5 h-3.5" />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleFeedback(1, "negative")}
                            className={`p-1.5 rounded-md transition-colors ${feedbackType === "negative" ? "text-red-400 bg-red-500/10" : "text-slate-500 hover:text-red-400 hover:bg-white/5"
                                }`}
                            title="Mala respuesta"
                        >
                            <ThumbsDown className="w-3.5 h-3.5" />
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleFeedback(5, "positive")}
                            className="p-1.5 rounded-md text-slate-500 hover:text-blue-400 hover:bg-white/5 transition-colors ml-1"
                            title="Guardar explícitamente"
                        >
                            <Save className="w-3.5 h-3.5" />
                        </motion.button>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
