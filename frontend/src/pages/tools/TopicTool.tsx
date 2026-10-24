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
import { GeneratorLayout } from "@/layouts/GeneratorLayout";
import { generatorService } from "@/lib/generator-service";
import { EngineSelector } from "@/components/EngineSelector";
import { useGeneratorRequest } from "@/hooks/useGeneratorRequest";
import { getInitialEngine } from "@/lib/engine-preference";

export default function TopicTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        numero: "",
        titulo: "",
        cuerpo: "",
        especialidad: "",
        parte: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateTopic({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Desarrollo de Temas"
            description="Genera partes de un tema de oposición con rigor académico y estructura oficial."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El desarrollo del tema aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label">Nº Tema</label>
                        <input type="text" className="lam-input"
                            placeholder="Ej. 14"
                            value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label">Cuerpo</label>
                        <input type="text" className="lam-input"
                            placeholder="Ej. Secundaria"
                            value={formData.cuerpo} onChange={e => setFormData({ ...formData, cuerpo: e.target.value })} required />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Título del Tema</label>
                    <input type="text" className="lam-input"
                        placeholder="Ej. El desarrollo evolutivo..."
                        value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Especialidad</label>
                    <input type="text" className="lam-input"
                        placeholder="Ej. Orientación Educativa, Matemáticas..."
                        value={formData.especialidad} onChange={e => setFormData({ ...formData, especialidad: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label">Parte a Desarrollar</label>
                    <textarea className="lam-input h-32 resize-none"
                        placeholder="Ej. Introducción y Epígrafe 1..."
                        value={formData.parte} onChange={e => setFormData({ ...formData, parte: e.target.value })} required />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Desarrollar Tema
                </button>
            </form>
        </GeneratorLayout>
    );
}
