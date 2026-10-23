/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Fragment, useMemo, type ReactNode } from "react";

import { cleanGeneratedText } from "@/lib/content-format";
import { cn } from "@/lib/utils";

type ContentBlock =
    | { type: "heading"; text: string; level: number }
    | { type: "paragraph"; text: string }
    | { type: "unordered"; items: string[] }
    | { type: "ordered"; items: string[] }
    | { type: "code"; text: string; language?: string };

type StructuredValue =
    | string
    | number
    | boolean
    | null
    | StructuredValue[]
    | { [key: string]: StructuredValue };

interface FormattedContentProps {
    content: string;
    className?: string;
    emptyState?: ReactNode;
}

function renderInline(text: string): ReactNode[] {
    const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
    return segments.map((segment, index) => {
        if (segment.startsWith("**") && segment.endsWith("**")) {
            return (
                <strong key={`${segment}-${index}`} className="font-semibold text-white">
                    {segment.slice(2, -2)}
                </strong>
            );
        }
        if (segment.startsWith("`") && segment.endsWith("`")) {
            return (
                <code
                    key={`${segment}-${index}`}
                    className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-100"
                >
                    {segment.slice(1, -1)}
                </code>
            );
        }
        return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
    });
}

function parseBlocks(content: string): ContentBlock[] {
    const lines = cleanGeneratedText(content).split("\n");
    const blocks: ContentBlock[] = [];
    let index = 0;

    while (index < lines.length) {
        const rawLine = lines[index];
        const trimmed = rawLine.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        if (trimmed.startsWith("```")) {
            const language = trimmed.slice(3).trim() || undefined;
            const codeLines: string[] = [];
            index += 1;
            while (index < lines.length && !lines[index].trim().startsWith("```")) {
                codeLines.push(lines[index]);
                index += 1;
            }
            if (index < lines.length) index += 1;
            blocks.push({ type: "code", text: codeLines.join("\n").trim(), language });
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: "heading",
                level: headingMatch[1].length,
                text: headingMatch[2].trim(),
            });
            index += 1;
            continue;
        }

        if (/^[-*•]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (index < lines.length && /^[-*•]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*•]\s+/, ""));
                index += 1;
            }
            blocks.push({ type: "unordered", items });
            continue;
        }

        if (/^\d+[.)]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
                index += 1;
            }
            blocks.push({ type: "ordered", items });
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
            const candidate = lines[index].trim();
            if (
                !candidate ||
                candidate.startsWith("```") ||
                /^#{1,4}\s+/.test(candidate) ||
                /^[-*•]\s+/.test(candidate) ||
                /^\d+[.)]\s+/.test(candidate)
            ) {
                break;
            }
            paragraphLines.push(candidate);
            index += 1;
        }

        blocks.push({
            type: "paragraph",
            text: paragraphLines.join(" "),
        });
    }

    return blocks;
}

function parseStructuredContent(content: string): StructuredValue | null {
    const cleaned = cleanGeneratedText(content);
    if (!cleaned) return null;
    if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
        return null;
    }

    try {
        const parsed = JSON.parse(cleaned) as StructuredValue;
        if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
}

function humanizeKey(key: string): string {
    return key
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\w/, (match) => match.toUpperCase());
}

function isRenderablePrimitive(value: StructuredValue): value is string | number | boolean | null {
    return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function renderStructuredValue(value: StructuredValue, path: string, depth = 0): ReactNode {
    if (value === null) {
        return <span className="text-sm italic text-slate-400">Sin dato relevante.</span>;
    }

    if (typeof value === "string") {
        return (
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
                {renderInline(value)}
            </p>
        );
    }

    if (typeof value === "number") {
        return <p className="text-[15px] font-medium leading-7 text-slate-100">{value}</p>;
    }

    if (typeof value === "boolean") {
        return (
            <span
                className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
                    value
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                )}
            >
                {value ? "Sí" : "No"}
            </span>
        );
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-sm italic text-slate-400">Sin elementos.</span>;
        }

        if (value.every((item) => isRenderablePrimitive(item))) {
            return (
                <ul className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-[15px] text-slate-100">
                    {value.map((item, index) => (
                        <li key={`${path}-${index}`} className="list-disc leading-7">
                            {item === null ? (
                                <span className="italic text-slate-400">Sin dato relevante.</span>
                            ) : typeof item === "string" ? (
                                renderInline(item)
                            ) : typeof item === "boolean" ? (
                                item ? "Sí" : "No"
                            ) : (
                                String(item)
                            )}
                        </li>
                    ))}
                </ul>
            );
        }

        return (
            <div className="space-y-3">
                {value.map((item, index) => (
                    <div
                        key={`${path}-${index}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                        {renderStructuredValue(item, `${path}-${index}`, depth + 1)}
                    </div>
                ))}
            </div>
        );
    }

    const entries = Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null) return false;
        if (typeof entryValue === "string") return entryValue.trim().length > 0;
        if (Array.isArray(entryValue)) return entryValue.length > 0;
        if (typeof entryValue === "object") return Object.keys(entryValue).length > 0;
        return true;
    });

    return (
        <div className="space-y-4">
            {entries.map(([key, entryValue]) => (
                <section
                    key={`${path}-${key}`}
                    className={cn(
                        "rounded-2xl border border-white/8 bg-white/[0.03] p-4",
                        depth === 0 ? "shadow-[0_0_0_1px_rgba(255,255,255,0.02)]" : ""
                    )}
                >
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200/90">
                        {humanizeKey(key)}
                    </div>
                    {renderStructuredValue(entryValue, `${path}-${key}`, depth + 1)}
                </section>
            ))}
        </div>
    );
}

function getHeadingClass(level: number): string {
    if (level <= 1) return "text-2xl font-semibold text-white";
    if (level === 2) return "text-xl font-semibold text-white";
    return "text-base font-semibold uppercase tracking-wide text-slate-100";
}

export function FormattedContent({
    content,
    className,
    emptyState = "El contenido generado aparecerá aquí.",
}: FormattedContentProps) {
    const cleaned = cleanGeneratedText(content);
    const structuredContent = useMemo(() => parseStructuredContent(content), [content]);
    const blocks = parseBlocks(content);

    if (!cleaned) {
        return (
            <div className={cn("rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400", className)}>
                {emptyState}
            </div>
        );
    }

    return (
        <div className={cn("space-y-4 text-slate-100", className)}>
            {structuredContent ? renderStructuredValue(structuredContent, "root") : null}
            {!structuredContent ? blocks.map((block, blockIndex) => {
                if (block.type === "heading") {
                    return (
                        <div key={`heading-${blockIndex}`} className={getHeadingClass(block.level)}>
                            {renderInline(block.text)}
                        </div>
                    );
                }

                if (block.type === "paragraph") {
                    return (
                        <p key={`paragraph-${blockIndex}`} className="whitespace-pre-wrap text-[15px] leading-7 text-slate-100">
                            {renderInline(block.text)}
                        </p>
                    );
                }

                if (block.type === "unordered") {
                    return (
                        <ul key={`unordered-${blockIndex}`} className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-[15px] text-slate-100">
                            {block.items.map((item, itemIndex) => (
                                <li key={`unordered-item-${itemIndex}`} className="list-disc leading-7">
                                    {renderInline(item)}
                                </li>
                            ))}
                        </ul>
                    );
                }

                if (block.type === "ordered") {
                    return (
                        <ol key={`ordered-${blockIndex}`} className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-4 text-[15px] text-slate-100">
                            {block.items.map((item, itemIndex) => (
                                <li key={`ordered-item-${itemIndex}`} className="list-decimal leading-7">
                                    {renderInline(item)}
                                </li>
                            ))}
                        </ol>
                    );
                }

                return (
                    <div key={`code-${blockIndex}`} className="overflow-x-auto rounded-2xl border border-sky-500/20 bg-[#0b1220] p-4">
                        {block.language ? (
                            <div className="mb-2 text-xs uppercase tracking-wide text-sky-300/80">{block.language}</div>
                        ) : null}
                        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-sky-100">
                            {block.text}
                        </pre>
                    </div>
                );
            }) : null}
        </div>
    );
}
