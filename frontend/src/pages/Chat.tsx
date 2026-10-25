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

import { useState, useRef, useEffect } from "react";
import { EngineSelector } from "../components/EngineSelector";
import { FormattedContent } from "@/components/FormattedContent";
import { useSearchParams } from "react-router-dom";
import { FeedbackButtons } from "../components/FeedbackButtons";
import { FeedbackModal } from "../components/FeedbackModal";
import { authFetch } from "@/lib/auth-client";
import { detectDeviceCapability } from "@/lib/device-capability";
import { getInitialEngine } from "@/lib/engine-preference";

// Queue Interface
interface QueueStatus {
    is_active: boolean;
    position: number;
    message: string;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

function parseBackendError(raw: string): string {
    const fallback = raw?.trim() || "Error al conectar con la IA.";
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.detail === "string" && parsed.detail.trim()) {
            return parsed.detail;
        }
    } catch {
        return fallback;
    }
    return fallback;
}

export default function Chat() {
    const [searchParams] = useSearchParams();
    const role = searchParams.get("role") || "docente";

    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: `Hola, soy tu asistente para el perfil de **${role}**. ¿En qué puedo ayudarte hoy?` }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const [engine, setEngine] = useState(getInitialEngine);
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

    // New State
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);

    // Poll Queue Status
    useEffect(() => {
        const checkQueue = async () => {
            try {
                const res = await authFetch("/queue/status");
                if (res.ok) {
                    const data = await res.json();
                    setQueueStatus(data);
                }
            } catch (e) {
                console.error("Queue check failed", e);
            }
        };
        checkQueue();
        const interval = setInterval(checkQueue, 30000); // Every 30s
        return () => clearInterval(interval);
    }, []);

    const handleExportClick = () => {
        setShowFeedbackModal(true);
    };

    const handleFeedbackSubmit = async (content: string, rating: number) => {
        // Send feedback
        try {
            await authFetch("/app-feedback/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content, rating, context: "chat_export" })
            });
        } catch (e) {
            console.error("Feedback error", e);
        }
        setShowFeedbackModal(false);
        downloadChat();
    };

    const downloadChat = () => {
        const text = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join("\n---\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-export-${new Date().toISOString()}.txt`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { role: "user" as const, content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);
        // F-03: una sola generación activa; Detener aborta la petición o la GPU.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Prepare for streaming response
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);

        try {
            if (engine === "webgpu") {
                try {
                    const capability = detectDeviceCapability();
                    if (!capability.hasWebGpu || capability.isLikelyLowEnd) {
                        throw new Error(
                            !capability.hasWebGpu
                                ? "WebGPU no está disponible en este dispositivo. Usa cloud/BYOK."
                                : "WebGPU desactivado por capacidad limitada del dispositivo. Usa cloud/BYOK."
                        );
                    }

                    const { webLlmService } = await import("@/lib/webllm-service");
                    // Initialize if needed (though it should be initialized by loader usually)
                    await webLlmService.initialize((msg) => console.log(msg));

                    // Use the correct prompt builder based on context or just generic chat
                    // For now, we'll use a generic prompt since Chat.tsx is general purpose
                    // But we can check if the last user message matches a specific intent if needed.

                    // Construct the prompt. For chat, we might just pass the last message.
                    // NOTE: webLlmService.generate takes a single string prompt currently.
                    // Ideally, we should refactor it to take messages, but for now:
                    let accumulated = "";
                    await webLlmService.generate(
                        messages.concat(userMsg).map((message) => ({
                            role: message.role,
                            content: message.content,
                        })),
                        (chunk) => {
                            accumulated += chunk;
                            setMessages(prev => {
                                const newHistory = [...prev];
                                newHistory[newHistory.length - 1] = { role: "assistant", content: accumulated };
                                return newHistory;
                            });
                        },
                        (initMsg) => console.log(initMsg),
                        controller.signal
                    );

                } catch (e) {
                    console.error("WebLLM Error:", e);
                    throw e; // Trigger catch block below
                }
            } else {
                // Server-side generation (existing code)
                const response = await authFetch("/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messages: [...messages, userMsg],
                        provider: engine,
                        api_key: apiKeys[engine] || "", // Only send if set, backend handles fallback
                        model: null
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(parseBackendError(errorBody || `HTTP ${response.status}`));
                }
                if (!response.body) throw new Error("No response body");

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let assistantMsg = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // stream: true evita que "ñ" o "á" partidas entre dos trozos salgan como �
                    const chunk = decoder.decode(value, { stream: true });
                    assistantMsg += chunk;

                    setMessages(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = { role: "assistant", content: assistantMsg };
                        return newHistory;
                    });
                }
            }

        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                // Cancelado por el usuario: se conserva lo generado hasta ese momento.
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    return last?.role === "assistant" && !last.content ? prev.slice(0, -1) : prev;
                });
            } else {
                console.error("Chat error:", error);
                const detail =
                    error instanceof Error && error.message.trim()
                        ? error.message
                        : "Error al conectar con la IA.";
                setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: detail }]);
            }
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setIsLoading(false);
        }
    };

    const handleStop = () => {
        abortRef.current?.abort();
    };

    const handleNewChat = () => {
        abortRef.current?.abort();
        setMessages([{ role: "assistant", content: `Hola, soy tu asistente para el perfil de **${role}**. ¿En qué puedo ayudarte hoy?` }]);
        setInput("");
    };

    const setKeyForEngine = (key: string) => {
        setApiKeys(prev => ({ ...prev, [engine]: key }));
    }

    return (
        <div className="flex h-screen bg-paper text-ink font-sans">
            {/* Barra lateral: historial como lista de filete */}
            <aside className="w-64 border-r border-hair bg-paper flex-col hidden md:flex">
                <div className="p-4 border-b-2 border-rule">
                    <h1 className="m-0 lam-mono lam-mono-ink">EDUmind · Chat IA</h1>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    <div className="lam-mono mb-2">Privacidad</div>
                    <p className="m-0 text-sm text-ink-2 leading-snug">
                        Las conversaciones no se guardan en el servidor. Al cerrar o recargar esta página desaparecen;
                        puedes descargarlas desde el botón de exportar.
                    </p>
                </div>
                <div className="p-4 border-t border-hair">
                    <button type="button" onClick={handleNewChat} className="lam-btn lam-btn-sm lam-btn-ghost lam-btn-block">
                        Nuevo chat
                    </button>
                </div>
            </aside>

            {/* Conversación */}
            <main className="flex-1 flex flex-col relative">
                {/* Cabecera */}
                <header className="min-h-16 border-b-2 border-rule flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-2 bg-paper absolute top-0 w-full z-10">
                    <div className="lam-mono lam-mono-ink">Asistente · {role}</div>
                    <EngineSelector
                        currentEngine={engine}
                        onSelect={setEngine}
                        apiKey={apiKeys[engine] || ""}
                        onApiKeyChange={setKeyForEngine}
                    />

                    <div className="flex items-center gap-3">
                        {queueStatus && (
                            <span className={`lam-mono border px-2.5 py-1.5 ${queueStatus.is_active ? "border-ok text-ok" : "border-vigencia text-vigencia"}`}>
                                {queueStatus.message}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleExportClick}
                            className="lam-btn lam-btn-sm lam-btn-ghost"
                            title="Exportar chat"
                        >
                            Exportar
                        </button>
                    </div>
                </header>

                <FeedbackModal
                    isOpen={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                    onSubmit={handleFeedbackSubmit}
                    onSkip={() => { setShowFeedbackModal(false); downloadChat(); }}
                />

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto pt-24 pb-36 px-4 md:px-16 lg:px-32">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col mb-7 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <span className="lam-mono mb-1.5">{msg.role === 'user' ? 'Tú' : 'EDUmind'}</span>
                            <div className={`max-w-[80%] px-5 py-4 ${msg.role === 'user'
                                ? 'bg-ink text-paper'
                                : 'bg-card text-ink border-l-[3px] border-mental'
                                }`}>
                                {msg.role === "assistant" ? (
                                    msg.content.trim() ? (
                                    <FormattedContent
                                        content={msg.content}
                                        className="space-y-3"
                                        emptyState="Pensando..."
                                    />
                                    ) : (
                                        <div className="text-sm text-ink-2">Pensando...</div>
                                    )
                                ) : (
                                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                )}
                                {msg.role === 'assistant' && !isLoading && (
                                    <FeedbackButtons
                                        instruction={messages[i - 1]?.content || "System Init"}
                                        output={msg.content}
                                        source={engine}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && !messages[messages.length - 1].content && (
                        <div className="flex flex-col items-start mb-7">
                            <span className="lam-mono mb-1.5">EDUmind</span>
                            <div className="h-10 w-24 bg-card border-l-[3px] border-mental animate-pulse" />
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Entrada */}
                <div className="absolute bottom-0 w-full p-4 md:p-6 bg-paper border-t border-hair">
                    <div className="max-w-4xl mx-auto bg-card border border-hair border-b-2 border-b-ink p-2 flex items-end gap-2 relative z-20">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={`Escribe un mensaje para ${engine}...`}
                            className="flex-1 bg-transparent border-none focus:outline-none text-ink placeholder:text-ink-3 resize-none max-h-32 py-2 px-2"
                            rows={1}
                        />
                        {isLoading ? (
                            <button type="button" onClick={handleStop} className="lam-btn lam-btn-sm lam-btn-ghost">
                                Detener
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="lam-btn lam-btn-sm"
                            >
                                Enviar
                            </button>
                        )}
                    </div>
                    <div className="lam-mono mt-3 text-center">
                        EDUmind puede cometer errores. Verifica la información importante.
                    </div>
                </div>
            </main>
        </div>
    );
}
