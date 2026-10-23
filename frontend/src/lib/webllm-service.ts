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

import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

let engine: MLCEngine | null = null;

type WebLlmMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

const SYSTEM_PROMPT = `Eres EDUmind, asistente educativo experto del sistema español.

Reglas:
- Responde con rigor pedagógico y normativo.
- Si no hay contexto suficiente, dilo explícitamente.
- Prioriza claridad, estructura y aplicabilidad real en aula/centro.
- No inventes normativa ni citas legales.`;

export const webLlmService = {
    initialize: async (onProgress: (text: string) => void) => {
        if (!engine) {
            onProgress("Iniciando motor WebGPU (primera carga puede tardar unos minutos)...");
            engine = await CreateMLCEngine(SELECTED_MODEL, {
                initProgressCallback: (report) => {
                    onProgress(report.text);
                },
            });
        }
        return engine;
    },

    generate: async (
        prompt: string | WebLlmMessage[],
        onChunk: (chunk: string) => void,
        onInit: (msg: string) => void
    ) => {
        try {
            const eng = await webLlmService.initialize(onInit);
            const messages: WebLlmMessage[] = Array.isArray(prompt)
                ? [
                    { role: "system", content: SYSTEM_PROMPT },
                    ...prompt.filter(
                        (message): message is WebLlmMessage =>
                            Boolean(message?.content?.trim()) &&
                            (message.role === "system" || message.role === "user" || message.role === "assistant")
                    ),
                ]
                : [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt },
                ];
            const chunks = await eng.chat.completions.create({
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 2048,
            });

            for await (const chunk of chunks) {
                const delta = chunk.choices[0]?.delta?.content || "";
                if (delta) onChunk(delta);
            }
        } catch (error) {
            console.error("WebLLM error:", error);
            onChunk(
                "\nError: No se pudo ejecutar el modelo local en navegador. Revisa soporte WebGPU (Chrome/Edge actualizado)."
            );
        }
    },

    buildGenericPrompt: (type: string, data: unknown) => {
        const normalizedType = (type || "generador").replace(/^\/+/, "");
        const serialized = JSON.stringify(data ?? {}, null, 2);
        return `Tarea: ${normalizedType}

Datos de entrada:
${serialized}

Instrucciones:
- Genera una respuesta técnica, práctica y accionable para contexto educativo español.
- Señala límites si falta información.`;
    },
};
