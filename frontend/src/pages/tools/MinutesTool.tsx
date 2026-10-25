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

export default function MinutesTool() {
    const { output, loading, error, runGeneration, retryLast, cancelGeneration } = useGeneratorRequest();
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKey, setApiKey] = useState("");

    const [formData, setFormData] = useState({
        tipo: "Claustro Ordinario",
        fecha: new Date().toISOString().split("T")[0],
        presentes: "",
        temas: "",
        acuerdos: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await runGeneration((onChunk, options) =>
            generatorService.generateMinutes({
                ...formData,
                provider: engine,
                api_key: apiKey
            }, onChunk, options)
        );
    };

    return (
        <GeneratorLayout
            title="Acta de Reunión"
            description="Redacción formal de actas para claustros, COCOPE y órganos colegiados."
            errorMessage={error}
            onRetry={retryLast}
            isLoading={loading}
            onCancel={cancelGeneration}
            preview={
                <div className="lam-prose">
                    {!output && !loading && <span className="text-ink-3">El acta generada aparecerá aquí...</span>}
                    {output && <div className="whitespace-pre-wrap">{output}</div>}
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <EngineSelector currentEngine={engine} onSelect={setEngine} apiKey={apiKey} onApiKeyChange={setApiKey} />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="minutes-tipo-de-reunion">Tipo de Reunión</label>
                        <select id="minutes-tipo-de-reunion" className="lam-input"
                            value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value })}>
                            <option>Claustro Ordinario</option>
                            <option>Claustro Extraordinario</option>
                            <option>COCOPE</option>
                            <option>Consejo Escolar</option>
                            <option>Reunión de Departamento</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="lam-label" htmlFor="minutes-fecha">Fecha</label>
                        <input id="minutes-fecha" type="date" className="lam-input"
                            value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="minutes-asistentes-ausentes">Asistentes / Ausentes</label>
                    <textarea id="minutes-asistentes-ausentes" className="lam-input h-20 resize-none"
                        placeholder="Lista de asistentes..."
                        value={formData.presentes} onChange={e => setFormData({ ...formData, presentes: e.target.value })} />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="minutes-temas-tratados">Temas Tratados</label>
                    <textarea id="minutes-temas-tratados" className="lam-input h-24 resize-none"
                        placeholder="Puntos del orden del día..."
                        value={formData.temas} onChange={e => setFormData({ ...formData, temas: e.target.value })} required />
                </div>

                <div className="space-y-2">
                    <label className="lam-label" htmlFor="minutes-acuerdos-adoptados">Acuerdos Adoptados</label>
                    <textarea id="minutes-acuerdos-adoptados" className="lam-input h-24 resize-none"
                        placeholder="Decisiones finales..."
                        value={formData.acuerdos} onChange={e => setFormData({ ...formData, acuerdos: e.target.value })} />
                </div>

                <button type="submit" disabled={loading} className="lam-btn lam-btn-block">
                    {loading && <span className="font-mono" aria-hidden="true">···</span>} Generar Acta
                </button>
            </form>
        </GeneratorLayout>
    );
}
