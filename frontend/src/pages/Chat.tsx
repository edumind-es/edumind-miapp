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
import { Send, Plus, Bot, User as UserIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { FeedbackButtons } from "../components/FeedbackButtons";
import { FeedbackModal } from "../components/FeedbackModal";
import { Download, Activity } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { detectDeviceCapability } from "@/lib/device-capability";

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
    const [engine, setEngine] = useState("edumind");
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
                        (initMsg) => console.log(initMsg)
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

                    const chunk = decoder.decode(value);
                    assistantMsg += chunk;

                    setMessages(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = { role: "assistant", content: assistantMsg };
                        return newHistory;
                    });
                }
            }

        } catch (error) {
            console.error("Chat error:", error);
            const detail =
                error instanceof Error && error.message.trim()
                    ? error.message
                    : "Error al conectar con la IA.";
            setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: detail }]);
        } finally {
            setIsLoading(false);
        }
    };

    const setKeyForEngine = (key: string) => {
        setApiKeys(prev => ({ ...prev, [engine]: key }));
    }

    return (
        <div className="flex h-screen bg-[#0f1117] text-white font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#0f1117] flex flex-col hidden md:flex">
                <div className="p-4 border-b border-white/5">
                    <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-600"></div>
                        EDUMind
                    </h1>
                </div>
                <div className="p-2 space-y-1 overflow-y-auto flex-1">
                    {/* History List Mockup */}
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500">Hoy</div>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-slate-300 truncate">
                        Planificación de 3º ESO
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-slate-300 truncate">
                        Rúbrica de evaluación oral
                    </button>
                </div>
                <div className="p-4 border-t border-white/5">
                    <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                        <Plus className="w-4 h-4" /> Nuevo Chat
                    </button>
                </div>
            </aside>

            {/* Main Chat */}
            <main className="flex-1 flex flex-col relative">
                {/* Header */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0f1117]/50 backdrop-blur-xl absolute top-0 w-full z-10">
                    <div className="font-medium text-slate-200 capitalize">{role} Assistant</div>
                    <EngineSelector
                        currentEngine={engine}
                        onSelect={setEngine}
                        apiKey={apiKeys[engine] || ""}
                        onApiKeyChange={setKeyForEngine}
                    />

                    <div className="flex items-center gap-4 ml-4">
                        {queueStatus && (
                            <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-1 rounded-full">
                                <Activity size={14} className={queueStatus.is_active ? "text-green-400" : "text-yellow-400"} />
                                <span className="text-slate-300">{queueStatus.message}</span>
                            </div>
                        )}
                        <button
                            onClick={handleExportClick}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                            title="Exportar Chat"
                        >
                            <Download size={20} />
                        </button>
                    </div>
                </header>

                <FeedbackModal
                    isOpen={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                    onSubmit={handleFeedbackSubmit}
                    onSkip={() => { setShowFeedbackModal(false); downloadChat(); }}
                />

                {/* Messages */}
                <div className="flex-1 overflow-y-auto pt-20 pb-32 px-4 md:px-20 lg:px-40 scrollbar-hide">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-4 mb-8 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}

                            <div className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-sm ${msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/5 text-slate-200 border border-white/5'
                                }`}>
                                {msg.role === "assistant" ? (
                                    msg.content.trim() ? (
                                    <FormattedContent
                                        content={msg.content}
                                        className="space-y-3"
                                        emptyState="Pensando..."
                                    />
                                    ) : (
                                        <div className="text-sm text-slate-400">Pensando...</div>
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

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                    <UserIcon className="w-5 h-5 text-slate-300" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && !messages[messages.length - 1].content && (
                        <div className="flex gap-4 mb-8">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 animate-pulse" />
                            <div className="h-10 w-24 bg-white/5 rounded-2xl animate-pulse" />
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 w-full p-4 md:p-6 bg-gradient-to-t from-[#0f1117] via-[#0f1117] to-transparent">
                    <div className="max-w-4xl mx-auto bg-[#1a1f2e] border border-white/10 rounded-2xl p-2 flex items-end gap-2 shadow-2xl relative z-20">
                        {/* Upload hidden for security/sustainability 
                        <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors" title="Subir PDF/Recurso">
                            <Upload className="w-5 h-5" />
                        </button>
                        */}
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
                            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-500 resize-none max-h-32 py-2"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="text-center text-xs text-slate-600 mt-2">
                        EDUMind AI puede cometer errores. Verifica la información importante.
                    </div>
                </div>
            </main>
        </div>
    );
}
