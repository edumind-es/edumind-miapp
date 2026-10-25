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
import { Link } from "react-router-dom";
import { exportService } from "@/lib/export-service";
import { authFetch } from "@/lib/auth-client";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { FormattedContent } from "@/components/FormattedContent";
import { NoticeBanner } from "@/components/NoticeBanner";
import { WebLLMLoader } from "@/components/WebLLMLoader";
import { ServerLoadingIndicator } from "@/components/ServerLoadingIndicator";
import { cleanGeneratedText, detectReviewFlags } from "@/lib/content-format";

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
    const previewText = useMemo(() => extractTextFromChildren(preview), [preview]);
    const cleanedPreviewText = useMemo(() => cleanGeneratedText(previewText), [previewText]);
    const [editableOutput, setEditableOutput] = useState(cleanedPreviewText);
    const [mobileView, setMobileView] = useState<"form" | "output">("form");
    const [outputMode, setOutputMode] = useState<"preview" | "edit">("preview");
    const [copied, setCopied] = useState(false);
    const [isContributing, setIsContributing] = useState(false);
    const [showContributeConfirm, setShowContributeConfirm] = useState(false);
    const [notice, setNotice] = useState<NoticeState>(null);

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
    // Avisos previos al uso: revisión humana (JSON) y códigos curriculares no encontrados.
    const reviewFlags = useMemo(() => detectReviewFlags(effectiveOutput), [effectiveOutput]);
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
                // El diálogo previo es el consentimiento: sin él el servidor rechaza la contribución.
                consent: true,
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

    const handleExport = async (format: 'pdf' | 'docx' | 'txt' | 'html') => {
        if (!effectiveOutput) return;
        try {
            const options = {
                content: effectiveOutput,
                filename: title.toLowerCase().replace(/\s+/g, '_'),
                title: title
            };

            if (format === 'pdf') await exportService.toPdf(options);
            else if (format === 'docx') await exportService.toDocx(options);
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

    const exportButtons: Array<{ format: "pdf" | "docx" | "html" | "txt"; label: string }> = [
        { format: "pdf", label: "PDF" },
        { format: "docx", label: "Word" },
        { format: "html", label: "HTML" },
        { format: "txt", label: "TXT" },
    ];

    return (
        <div className="min-h-screen bg-paper text-ink">
            {/* Conmutador móvil formulario / resultado */}
            <div className="lg:hidden sticky top-[62px] z-20 bg-paper border-b border-hair px-4 py-3">
                <div className="lam-seg w-full">
                    <button type="button" onClick={() => setMobileView("form")} aria-pressed={mobileView === "form"} className="flex-1">
                        Formulario
                    </button>
                    <button type="button" onClick={() => setMobileView("output")} aria-pressed={mobileView === "output"} className="flex-1">
                        Resultado
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:min-h-screen">
                {/* Panel izquierdo: formulario */}
                <section
                    className={`bg-paper border-b border-hair lg:border-b-0 lg:border-r lg:border-hair lg:w-[38%] lg:min-w-[360px] xl:min-w-[420px] ${
                        mobileView === "form" ? "flex flex-col" : "hidden lg:flex lg:flex-col"
                    }`}
                >
                    <div className="p-5 sm:p-7 border-b-2 border-rule">
                        <Link to="/" className="lam-mono lam-mono-ink inline-block mb-5 hover:underline underline-offset-4">
                            ← Volver
                        </Link>
                        <p className="lam-eyebrow mb-3">EDUmind · Generador</p>
                        <h1 className="m-0 text-[26px] sm:text-[30px] font-bold leading-[1.05] tracking-[-0.02em]">{title}</h1>
                        <p className="mt-3 text-[15px] leading-6 text-ink-2 max-w-[48ch]">{description}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 sm:p-7">
                        {children}
                    </div>
                </section>

                {/* Panel derecho: resultado editable */}
                <section
                    className={`relative flex-1 bg-card flex-col ${
                        mobileView === "output" ? "flex" : "hidden lg:flex"
                    }`}
                >
                    <div className="border-b-2 border-rule px-4 py-3 sm:px-6 flex flex-wrap items-center gap-2">
                        <span className="lam-mono mr-2">Resultado</span>
                        <button onClick={handleCopy} className="lam-btn lam-btn-sm lam-btn-ghost" disabled={!effectiveOutput}>
                            {copied ? "Copiado" : "Copiar"}
                        </button>
                        {exportButtons.map((item) => (
                            <button
                                key={item.format}
                                onClick={() => handleExport(item.format)}
                                className="lam-btn lam-btn-sm lam-btn-ghost"
                                disabled={!effectiveOutput}
                            >
                                {item.label}
                            </button>
                        ))}
                        <button
                            onClick={handleContribute}
                            disabled={!effectiveOutput || isContributing}
                            className="lam-btn lam-btn-sm lam-btn-ghost"
                        >
                            {isContributing ? "Enviando..." : "Contribuir"}
                        </button>
                        {isLoading && onCancel && (
                            <button onClick={onCancel} className="lam-btn lam-btn-sm !border-alert !text-alert hover:!bg-alert hover:!text-paper ml-auto">
                                Cancelar
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-hidden p-5 sm:p-7 lg:p-9 xl:p-12 flex flex-col">
                        {notice ? (
                            <NoticeBanner
                                variant={notice.variant}
                                message={notice.message}
                                className="mb-5"
                                onClose={() => setNotice(null)}
                            />
                        ) : null}
                        {reviewFlags.humanReview ? (
                            <NoticeBanner
                                variant="warning"
                                className="mb-5"
                                message="El modelo ha marcado esta salida como pendiente de revisión humana: contrástala antes de usarla."
                            />
                        ) : null}
                        {reviewFlags.unknownCurriculumCodes.length ? (
                            <NoticeBanner
                                variant="warning"
                                className="mb-5"
                                message={`Revisión curricular: la salida cita códigos que no existen en la matriz oficial elegida (${reviewFlags.unknownCurriculumCodes.join(", ")}).`}
                            />
                        ) : null}

                        {errorMessage && (
                            <div className="lam-note alert mb-5 flex items-start justify-between gap-4">
                                <div>
                                    <span className="tag">Error</span>
                                    <p className="m-0 text-[15px] leading-6">{errorMessage}</p>
                                </div>
                                {onRetry && (
                                    <button type="button" onClick={onRetry} className="lam-btn lam-btn-sm lam-btn-ghost shrink-0">
                                        Reintentar
                                    </button>
                                )}
                            </div>
                        )}

                        {effectiveOutput ? (
                            <>
                                <div className="mb-5">
                                    <div className="lam-seg">
                                        <button type="button" onClick={() => setOutputMode("preview")} aria-pressed={outputMode === "preview"}>
                                            Vista previa
                                        </button>
                                        <button type="button" onClick={() => setOutputMode("edit")} aria-pressed={outputMode === "edit"}>
                                            Editar texto
                                        </button>
                                    </div>
                                </div>
                                {outputMode === "edit" ? (
                                    <EditableOutputArea
                                        key={`${editorKey}-edit`}
                                        initialValue={effectiveOutput}
                                        onValueChange={setEditableOutput}
                                        className="lam-textarea flex-1 w-full !resize-none font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap"
                                        placeholder="El resultado aparecerá aquí."
                                    />
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-1 lam-prose">
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
                                <div className="flex-1 lam-prose text-ink-2">
                                    {preview}
                                </div>
                            )}
                    </div>
                </section>
            </div>
            <ConfirmationDialog
                open={showContributeConfirm}
                title="Aportar esta salida al dataset"
                description="Esta salida se guardará en el dataset de entrenamiento de EDUmind y la revisará una persona antes de usarse. Al enviarla confirmas que no contiene nombres, datos de alumnado ni información personal. Los correos, teléfonos y documentos de identidad que se detecten se eliminan automáticamente."
                confirmLabel="Doy mi consentimiento y envío"
                cancelLabel="Revisar antes"
                busy={isContributing}
                onConfirm={confirmContribute}
                onCancel={() => setShowContributeConfirm(false)}
            />
        </div>
    );
}
