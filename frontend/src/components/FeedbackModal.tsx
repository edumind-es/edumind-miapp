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

import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string, rating: number) => void;
    onSkip: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit, onSkip }) => {
    const [content, setContent] = useState('');
    const [rating, setRating] = useState(5);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700"
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                            Ayúdanos a mejorar
                        </h3>
                        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 mb-4 text-sm">
                        Para descargar el contenido, por favor comparte una breve sugerencia sobre cómo mejorar la aplicación. ¡Tu opinión es vital!
                    </p>

                    <textarea
                        className="w-full h-32 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none resize-none text-slate-800 dark:text-slate-200"
                        placeholder="Me gustaría que..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />

                    <div className="flex justify-center gap-2 my-4">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'grayscale-0' : 'grayscale opacity-30 color-slate-400'
                                    }`}
                            >
                                ⭐
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3 justify-end mt-2">
                        <button
                            onClick={onSkip}
                            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Saltar
                        </button>
                        <button
                            onClick={() => onSubmit(content, rating)}
                            disabled={content.length < 5}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Send size={16} />
                            Enviar y Descargar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
