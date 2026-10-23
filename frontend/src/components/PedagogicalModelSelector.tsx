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
import { PEDAGOGICAL_MODELS } from "@/lib/pedagogical-models";

interface PedagogicalModelSelectorProps {
    value: string;
    customValue?: string;
    onChange: (model: string, customModel?: string) => void;
}

export function PedagogicalModelSelector({ value, customValue, onChange }: PedagogicalModelSelectorProps) {
    const [showCustom, setShowCustom] = useState(value === "otro");

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value;
        setShowCustom(selected === "otro");
        onChange(selected, selected === "otro" ? customValue : undefined);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange("otro", e.target.value);
    };

    return (
        <div className="space-y-2">
            <label className="lam-label">Modelo Pedagógico</label>
            <select
                className="lam-input"
                value={value}
                onChange={handleChange}
            >
                <option value="">Selecciona un modelo...</option>
                {PEDAGOGICAL_MODELS.map((model) => (
                    <option key={model.id} value={model.id} title={model.desc}>
                        {model.name}
                    </option>
                ))}
                <option value="otro">Otro (especificar)</option>
            </select>

            {/* Description of selected model */}
            {value && value !== "otro" && (
                <p className="text-xs text-ink-2 border-l-2 border-hair pl-2">
                    {PEDAGOGICAL_MODELS.find(m => m.id === value)?.desc}
                </p>
            )}

            {/* Custom model input */}
            {showCustom && (
                <input
                    type="text"
                    className="lam-input mt-2"
                    placeholder="Describe el modelo pedagógico..."
                    value={customValue || ""}
                    onChange={handleCustomChange}
                />
            )}
        </div>
    );
}
