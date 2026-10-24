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

// Modal de sugerencias en modo EDUmind-Lámina: recuadro de papel con filete de tinta,
// valoración 1-5 como segmento de inversión de tinta. Sin iconos, emoji ni animación.

import React, { useState } from 'react';

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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(23, 24, 26, 0.55)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
        >
            <div className="bg-paper border-2 border-ink p-6 w-full max-w-md">
                <div className="flex justify-between items-start mb-4 gap-4">
                    <div>
                        <span className="lam-mono">Sugerencia</span>
                        <h3 id="feedback-modal-title" className="mt-2 text-[22px] font-bold leading-tight">
                            Ayúdanos a mejorar
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="lam-mono lam-mono-ink hover:underline underline-offset-4"
                        aria-label="Cerrar"
                    >
                        Cerrar
                    </button>
                </div>

                <p className="text-ink-2 mb-4 text-[15px] leading-6">
                    Para descargar el contenido, comparte una breve sugerencia sobre cómo mejorar la aplicación.
                    Tu opinión es la que orienta el desarrollo.
                </p>

                <textarea
                    className="lam-textarea h-32"
                    placeholder="Me gustaría que..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                />

                <div className="my-4">
                    <span className="lam-label">Valoración</span>
                    <div className="lam-seg w-full" role="radiogroup" aria-label="Valoración de 1 a 5">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                role="radio"
                                aria-checked={star === rating}
                                aria-pressed={star <= rating}
                                onClick={() => setRating(star)}
                                className="flex-1"
                            >
                                {star}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-2">
                    <button type="button" onClick={onSkip} className="lam-btn lam-btn-sm lam-btn-ghost">
                        Saltar
                    </button>
                    <button
                        type="button"
                        onClick={() => onSubmit(content, rating)}
                        disabled={content.length < 5}
                        className="lam-btn lam-btn-sm"
                    >
                        Enviar y descargar
                    </button>
                </div>
            </div>
        </div>
    );
};
