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
import { NEAE_CATEGORIES, type NEAECase } from "@/lib/neae";

interface NEAEDetailedSelectorProps {
    cases: NEAECase[];
    onChange: (cases: NEAECase[]) => void;
}

export function NEAEDetailedSelector({ cases, onChange }: NEAEDetailedSelectorProps) {
    const [expanded, setExpanded] = useState<string | null>(null);

    const toggleCategory = (categoryId: string) => {
        const existing = cases.find(c => c.categoryId === categoryId);
        if (existing) {
            // Remove case
            onChange(cases.filter(c => c.categoryId !== categoryId));
        } else {
            // Add with default level
            onChange([...cases, { categoryId, levelId: NEAE_CATEGORIES.find(c => c.id === categoryId)?.levels[0].id || "" }]);
        }
    };

    const updateLevel = (categoryId: string, levelId: string) => {
        onChange(cases.map(c => c.categoryId === categoryId ? { ...c, levelId } : c));
    };

    const updateCount = (categoryId: string, count: number) => {
        onChange(cases.map(c => c.categoryId === categoryId ? { ...c, count } : c));
    };

    const updateNotes = (categoryId: string, notes: string) => {
        onChange(cases.map(c => c.categoryId === categoryId ? { ...c, notes } : c));
    };

    const isSelected = (categoryId: string) => cases.some(c => c.categoryId === categoryId);
    const getCase = (categoryId: string) => cases.find(c => c.categoryId === categoryId);

    return (
        <div className="space-y-2">
            <label className="lam-label">
                Alumnado con Necesidades Específicas de Apoyo Educativo (NEAE)
            </label>
            <p className="text-xs text-ink-2 mb-2">
                Selecciona las casuísticas presentes en el aula y su nivel de apoyo necesario
            </p>

            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
                {NEAE_CATEGORIES.map((category) => {
                    const selected = isSelected(category.id);
                    const caseData = getCase(category.id);
                    const isExpanded = expanded === category.id;

                    return (
                        <div key={category.id} className="border border-hair overflow-hidden">
                            {/* Category Header */}
                            <div
                                className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${selected ? "bg-paper-2 border-l-2 border-ink" : "bg-card hover:bg-paper-2"}`}
                                onClick={() => toggleCategory(category.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => { }}
                                        className="border-hair bg-card accent-ink"
                                    />
                                    <span className="text-sm text-ink font-medium">{category.name}</span>
                                </div>
                                {selected && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpanded(isExpanded ? null : category.id);
                                        }}
                                        className="lam-mono lam-mono-ink px-1 hover:underline underline-offset-4"
                                    >
                                        {isExpanded ? "Ocultar" : "Detalle"}
                                    </button>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {selected && isExpanded && (
                                <div className="p-3 bg-card space-y-3 border-t border-hair">
                                    <p className="text-xs text-ink-2">{category.description}</p>

                                    {/* Level Selection */}
                                    <div className="space-y-1">
                                        <span className="text-xs font-medium text-ink-2">Nivel de apoyo:</span>
                                        <div className="grid grid-cols-1 gap-1">
                                            {category.levels.map((level) => (
                                                <label
                                                    key={level.id}
                                                    className={`flex items-start gap-2 p-2 cursor-pointer transition-colors ${caseData?.levelId === level.id
                                                        ? "bg-paper-2 border border-ink"
                                                        : "bg-card hover:bg-paper-2 border border-transparent"}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`level-${category.id}`}
                                                        checked={caseData?.levelId === level.id}
                                                        onChange={() => updateLevel(category.id, level.id)}
                                                        className="mt-0.5 accent-ink"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-medium text-ink">{level.label}</span>
                                                        <p className="text-xs text-ink-2">{level.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Count */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-ink-2">Nº alumnos/as:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={caseData?.count || 1}
                                            onChange={(e) => updateCount(category.id, parseInt(e.target.value) || 1)}
                                            className="lam-input w-16 !px-2 !py-1 text-xs"
                                        />
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <span className="text-xs text-ink-2">Observaciones (opcional):</span>
                                        <input
                                            type="text"
                                            value={caseData?.notes || ""}
                                            onChange={(e) => updateNotes(category.id, e.target.value)}
                                            placeholder="Información adicional relevante..."
                                            className="lam-input mt-1 !px-2 !py-1 text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary */}
            {cases.length > 0 && (
                <div className="mt-2 px-2 py-1.5 border-l-2 border-ink bg-paper-2">
                    <span className="lam-mono lam-mono-ink">
                        {cases.length} casuística{cases.length > 1 ? "s" : ""} seleccionada{cases.length > 1 ? "s" : ""}
                    </span>
                </div>
            )}
        </div>
    );
}
