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

import { isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Copy, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { exportService } from "@/lib/export-service";
import { authFetch } from "@/lib/auth-client";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FormattedContent } from "@/components/FormattedContent";
import { NoticeBanner } from "@/components/NoticeBanner";
import { WebLLMLoader } from "@/components/WebLLMLoader";
import { ServerLoadingIndicator } from "@/components/ServerLoadingIndicator";
import { cleanGeneratedText } from "@/lib/content-format";

interface GeneratorLayoutProps {
    title: string;
    description: string;
    children: ReactNode; // Form
    preview: ReactNode; // Generated Output (will be converted to string)
    // New loading props
    isServerLoading?: boolean;
    serverEstimatedTime?: number;
    serverModelType?: "fast" | "quality";
    errorMessage?: string | null;
    onRetry?: () => void;
    isLoading?: boolean;
    onCancel?: () => void;
}

const DEFAULT_EMPTY_PREVIEW = "El contenido generado aparecerá aquí.";

function extractTextFromChildren(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractTextFromChildren).join("");
    if (isValidElement<{ children?: ReactNode }>(node)) {
        return extractTextFromChildren(node.props.children ?? "");
    }
    return "";
}

interface EditableOutputAreaProps {
    initialValue: string;
    className: string;
    placeholder: string;
    onValueChange: (value: string) => void;
}

function EditableOutputArea({
    initialValue,
    className,
    placeholder,
    onValueChange,
}: EditableOutputAreaProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        onValueChange(value);
    }, [onValueChange, value]);

    return (
        <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={className}
            placeholder={placeholder}
        />
    );
}

type NoticeState = {
    variant: "success" | "error" | "info";
    message: string;
} | null;

export function GeneratorLayout({
    title,
    description,
    children,
    preview,
    isServerLoading = false,
    serverEstimatedTime = 90,
    serverModelType = "quality",
    errorMessage = null,
    onRetry,
    isLoading = false,
    onCancel
}: GeneratorLayoutProps) {
    const [usage] = useState(() => parseInt(localStorage.getItem("edumind_usage") || "0"));
    const previewText = useMemo(() => extractTextFromChildren(preview), [preview]);
    const cleanedPreviewText = useMemo(() => cleanGeneratedText(previewText), [previewText]);
    const [editableOutput, setEditableOutput] = useState(cleanedPreviewText);
    const [mobileView, setMobileView] = useState<"form" | "output">("form");
    const [outputMode, setOutputMode] = useState<"preview" | "edit">("preview");
    const [copied, setCopied] = useState(false);
    const [isContributing, setIsContributing] = useState(false);
    const [showContributeConfirm, setShowContributeConfirm] = useState(false);
    const [notice, setNotice] = useState<NoticeState>(null);
    const LIMIT = 1000;

    useEffect(() => {
        setEditableOutput(cleanedPreviewText);
        setOutputMode("preview");
    }, [cleanedPreviewText]);

    const effectiveOutput = useMemo(() => {
        const candidate = (editableOutput || cleanedPreviewText || "").trim();
        if (!candidate || candidate === DEFAULT_EMPTY_PREVIEW) {
            return "";
        }
        return candidate;
    }, [cleanedPreviewText, editableOutput]);
    const editorKey = `${previewText.length}-${previewText.slice(0, 64)}`;
    const systemProgress = useMemo(() => {
        const progressLines = previewText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("[Sistema]:"));
        return progressLines.length > 0
            ? progressLines[progressLines.length - 1].replace("[Sistema]:", "").trim()
            : "";
    }, [previewText]);

    const handleCopy = async () => {
        if (effectiveOutput) {
            await navigator.clipboard.writeText(effectiveOutput);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleContribute = async () => {
        if (!effectiveOutput || isContributing) return;
        setShowContributeConfirm(true);
    };

    const confirmContribute = async () => {
        if (!effectiveOutput || isContributing) return;

        try {
            setIsContributing(true);
            setShowContributeConfirm(false);
            setNotice(null);
            const payload = {
                instruction: `${title} (contribución voluntaria)`,
                output: effectiveOutput,
                tool: window.location.pathname.replace(/^\/+/, "") || "generador",
                provider: "unknown",
            };
            const response = await authFetch("/generators/contribute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "No se pudo registrar la contribución.");
            }

            setNotice({
                variant: "success",
                message: "Contribución enviada. Queda pendiente de revisión individual en el panel admin.",
            });
        } catch (error) {
            console.error("Contribution failed:", error);
            setNotice({
                variant: "error",
                message: "No se pudo registrar la contribución. Inténtalo de nuevo.",
            });
        } finally {
            setIsContributing(false);
        }
    };

    const handleExport = async (format: 'pdf' | 'txt' | 'html') => {
        if (!effectiveOutput) return;
        try {
            const options = {
                content: effectiveOutput,
                filename: title.toLowerCase().replace(/\s+/g, '_'),
                title: title
            };

            if (format === 'pdf') await exportService.toPdf(options);
            else if (format === 'txt') await exportService.toTxt(options);
            else if (format === 'html') await exportService.toHtml(options);
            setNotice({
                variant: "success",
                message: `Exportación ${format.toUpperCase()} generada correctamente.`,
            });
        } catch (error) {
            console.error('Export failed:', error);
            setNotice({
                variant: "error",
                message: "Error al exportar. Por favor, inténtalo de nuevo.",
            });
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1117] text-white">
            <div className="lg:hidden sticky top-0 z-20 bg-[#0f1117]/95 backdrop-blur border-b border-white/10 p-3">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setMobileView("form")}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            mobileView === "form"
                                ? "bg-blue-600 text-white"
                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                    >
                        Formulario
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileView("output")}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            mobileView === "output"
                                ? "bg-blue-600 text-white"
                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                    >
                        Resultado
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:min-h-screen">
                {/* Left Panel: Form */}
                <section
                    className={`bg-[#0f1117] border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10 lg:w-[38%] lg:min-w-[360px] xl:min-w-[420px] ${
                        mobileView === "form" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
                    }`}
                >
                    <div className="p-4 sm:p-6 border-b border-white/10">
                        <Link to="/" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Volver
                        </Link>
                        <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            {title}
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">{description}</p>

                        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Uso Demo en la Nube</span>
                                <span>{usage}/{LIMIT}</span>
                            </div>
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min((usage / LIMIT) * 100, 100)}%` }} />
                            </div>
                            {usage >= LIMIT && (
                                <div className="mt-2 text-xs text-red-300">
                                    🔒 Límite alcanzado. <a href="#" className="underline font-bold">Instala EDUmind Local</a> para uso ilimitado.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
                        {children}
                    </div>
                </section>

                {/* Right Panel: Editable Output */}
                <section
                    className={`relative flex-1 bg-[#1a1f2e] flex-col ${
                        mobileView === "output" ? "flex" : "hidden lg:flex"
                    }`}
                >
                    <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20" />

                    <div className="border-b border-white/10 px-3 py-3 sm:px-4 flex flex-wrap gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!effectiveOutput}
                        >
                            <Copy className="w-3 h-3" />
                            {copied ? "¡Copiado!" : "Copiar"}
                        </button>
                        <button
                            onClick={() => handleExport("pdf")}
                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!effectiveOutput}
                        >
                            <Download className="w-3 h-3" />
                            PDF
                        </button>
                        <button
                            onClick={() => handleExport("html")}
                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!effectiveOutput}
                        >
                            HTML
                        </button>
                        <button
                            onClick={() => handleExport("txt")}
                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!effectiveOutput}
                        >
                            TXT
                        </button>
                        <button
                            onClick={handleContribute}
                            disabled={!effectiveOutput || isContributing}
                            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isContributing ? "Enviando..." : "👍 Contribuir"}
                        </button>
                        {isLoading && onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8 xl:p-12 flex flex-col">
                        {notice ? (
                            <NoticeBanner
                                variant={notice.variant}
                                message={notice.message}
                                className="mb-4"
                                onClose={() => setNotice(null)}
                            />
                        ) : null}

                        {errorMessage && (
                            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-200 flex items-center justify-between gap-3">
                                <span>{errorMessage}</span>
                                {onRetry && (
                                    <button
                                        type="button"
                                        onClick={onRetry}
                                        className="shrink-0 rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-100 hover:bg-rose-800/40"
                                    >
                                        Reintentar
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Server loading indicator (EDUmind v2) */}
                        {effectiveOutput ? (
                            <>
                                <div className="mb-4 flex items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setOutputMode("preview")}
                                        className={`rounded-full px-3 py-1 transition-colors ${
                                            outputMode === "preview"
                                                ? "bg-blue-600 text-white"
                                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                                        }`}
                                    >
                                        Vista previa
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOutputMode("edit")}
                                        className={`rounded-full px-3 py-1 transition-colors ${
                                            outputMode === "edit"
                                                ? "bg-blue-600 text-white"
                                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                                        }`}
                                    >
                                        Editar texto
                                    </button>
                                </div>
                                {outputMode === "edit" ? (
                                    <EditableOutputArea
                                        key={`${editorKey}-edit`}
                                        initialValue={effectiveOutput}
                                        onValueChange={setEditableOutput}
                                        className="flex-1 w-full rounded-2xl border border-white/10 bg-black/10 p-5 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 whitespace-pre-wrap font-mono text-sm leading-relaxed scrollbar-thin"
                                        placeholder="El resultado aparecerá aquí..."
                                    />
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
                                        <FormattedContent content={effectiveOutput} />
                                    </div>
                                )}
                            </>
                        ) : isServerLoading ? (
                            <ServerLoadingIndicator
                                isLoading={true}
                                estimatedSeconds={serverEstimatedTime}
                                modelType={serverModelType}
                            />
                        ) : systemProgress ? (
                                <WebLLMLoader
                                    progress={systemProgress}
                                    isComplete={false}
                                />
                            ) : (
                                <div className="flex-1 prose prose-invert max-w-none">
                                    {preview}
                                </div>
                            )}
                    </div>
                </section>
            </div>
            <ConfirmationDialog
                open={showContributeConfirm}
                title="Aportar esta salida al dataset"
                description="Se guardará para revisión manual en admin. Asegúrate de que el contenido esté limpio, útil y sin datos sensibles antes de enviarlo."
                confirmLabel="Enviar contribución"
                cancelLabel="Revisar antes"
                busy={isContributing}
                onConfirm={confirmContribute}
                onCancel={() => setShowContributeConfirm(false)}
            />
        </div>
    );
}
