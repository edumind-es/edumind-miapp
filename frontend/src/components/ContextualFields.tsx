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

export interface ContextualData {
    num_alumnos?: number;
    tipo_agrupamiento?: string;
    metodologia_slider?: number;
    neae_cases?: string[];
    neae_otros?: string;
    contexto_adicional?: string;
}

interface ContextualFieldsProps {
    data: ContextualData;
    onChange: (data: ContextualData) => void;
}

const NEAE_COMMON_CASES = [
    "TDAH",
    "Dislexia",
    "TEA (Trastorno Espectro Autista)",
    "Altas Capacidades",
    "Discapacidad Motriz",
    "Déficit Visual",
    "Déficit Auditivo",
    "Discalculia",
    "TANV (Trastorno Aprendizaje No Verbal)"
];

const GROUPING_TYPES = [
    "Individual",
    "Parejas",
    "Grupos pequeños (3-5)",
    "Grupos grandes (6+)",
    "Gran grupo",
    "Agrupamiento flexible"
];

export function ContextualFields({ data, onChange }: ContextualFieldsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleCase = (caseItem: string) => {
        const current = data.neae_cases || [];
        const updated = current.includes(caseItem)
            ? current.filter(c => c !== caseItem)
            : [...current, caseItem];
        onChange({ ...data, neae_cases: updated });
    };

    const getMethodologyLabel = (value: number): string => {
        if (value < 30) return "Tradicional";
        if (value < 70) return "Equilibrado";
        return "Innovador";
    };

    return (
        <div className="border border-hair bg-card">
            {/* Toggle Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between lam-label hover:text-ink transition-colors"
            >
                <span>Información contextual (opcional, recomendado)</span>
                <span className="lam-mono lam-mono-ink">{isExpanded ? "Ocultar" : "Mostrar"}</span>
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-4 space-y-4 border-t border-hair">
                    {/* Number of Students */}
                    <div className="space-y-2">
                        <label className="lam-label">Número de Alumnos</label>
                        <input
                            type="number"
                            min="1"
                            max="40"
                            placeholder="Ej: 25"
                            className="lam-input"
                            value={data.num_alumnos || ""}
                            onChange={e => onChange({ ...data, num_alumnos: parseInt(e.target.value) || undefined })}
                        />
                    </div>

                    {/* Grouping Type */}
                    <div className="space-y-2">
                        <label className="lam-label">Tipo de Agrupamiento</label>
                        <select
                            className="lam-input"
                            value={data.tipo_agrupamiento || ""}
                            onChange={e => onChange({ ...data, tipo_agrupamiento: e.target.value })}
                        >
                            <option value="">No especificado</option>
                            {GROUPING_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* Methodology Slider */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="lam-label">Enfoque Metodológico</label>
                            {/* Etiqueta del enfoque: inversión de tinta, sin color saturado */}
                            <span className="lam-mono lam-mono-ink bg-ink !text-paper px-2 py-1">
                                {getMethodologyLabel(data.metodologia_slider || 50)}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={data.metodologia_slider || 50}
                                onChange={e => onChange({ ...data, metodologia_slider: parseInt(e.target.value) })}
                                className="w-full accent-ink"
                            />
                            <div className="flex justify-between text-xs text-ink-2">
                                <span>Tradicional</span>
                                <span>Innovador</span>
                            </div>
                        </div>
                        <p className="text-xs text-ink-2 mt-1">
                            {data.metodologia_slider !== undefined && (
                                <>
                                    {data.metodologia_slider < 30 && "Instrucción directa, ejercicios estructurados, evaluación tradicional"}
                                    {data.metodologia_slider >= 30 && data.metodologia_slider < 70 && "Combina métodos tradicionales con aprendizaje activo"}
                                    {data.metodologia_slider >= 70 && "ABP, aprendizaje colaborativo, uso intensivo de tecnología"}
                                </>
                            )}
                        </p>
                    </div>

                    {/* NEAE Cases */}
                    <div className="space-y-2">
                        <label className="lam-label">Casuísticas NEAE Presentes</label>
                        <div className="grid grid-cols-2 gap-2">
                            {NEAE_COMMON_CASES.map(caseItem => (
                                <label key={caseItem} className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer hover:text-ink transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={(data.neae_cases || []).includes(caseItem)}
                                        onChange={() => toggleCase(caseItem)}
                                        className="border-hair bg-card accent-ink"
                                    />
                                    {caseItem}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Other NEAE */}
                    <div className="space-y-2">
                        <label className="lam-label">Otros Casos NEAE Específicos</label>
                        <textarea
                            className="lam-input h-16 resize-none"
                            placeholder="Describe otros casos específicos..."
                            value={data.neae_otros || ""}
                            onChange={e => onChange({ ...data, neae_otros: e.target.value })}
                        />
                    </div>

                    {/* Additional Context */}
                    <div className="space-y-2">
                        <label className="lam-label">Contexto Adicional Relevante</label>
                        <textarea
                            className="lam-input h-20 resize-none"
                            placeholder="Cualquier información adicional que pueda mejorar la respuesta (entorno socioeconómico, características del centro, recursos disponibles, etc.)"
                            value={data.contexto_adicional || ""}
                            onChange={e => onChange({ ...data, contexto_adicional: e.target.value })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
