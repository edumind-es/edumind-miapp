/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneratorRunOptions } from "@/lib/generator-service";

type ChunkCallback = (chunk: string) => void;
type GenerationExecutor = (
    onChunk: ChunkCallback,
    options?: GeneratorRunOptions
) => Promise<void>;

function isAbortError(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        const message = error.message?.trim();
        if (!message) return "No se pudo completar la generación.";
        try {
            const parsed = JSON.parse(message);
            if (parsed?.detail && typeof parsed.detail === "string") {
                return parsed.detail;
            }
        } catch {
            // Non-JSON message; return as-is.
        }
        return message;
    }
    if (typeof error === "string" && error.trim()) return error;
    return "No se pudo completar la generación.";
}

export function useGeneratorRequest() {
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastExecutorRef = useRef<GenerationExecutor | null>(null);

    const runGeneration = useCallback(async (executor: GenerationExecutor) => {
        abortRef.current?.abort();

        const controller = new AbortController();
        abortRef.current = controller;
        lastExecutorRef.current = executor;

        setLoading(true);
        setError(null);
        setOutput("");

        try {
            await executor((chunk) => {
                setOutput((prev) => prev + chunk);
            }, { signal: controller.signal });
        } catch (err) {
            if (!isAbortError(err)) {
                setError(extractErrorMessage(err));
            }
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
                setLoading(false);
            }
        }
    }, []);

    const retryLast = useCallback(async () => {
        const executor = lastExecutorRef.current;
        if (!executor) return;
        await runGeneration(executor);
    }, [runGeneration]);

    const cancelGeneration = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLoading(false);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            abortRef.current = null;
        };
    }, []);

    return {
        output,
        setOutput,
        loading,
        error,
        runGeneration,
        retryLast,
        cancelGeneration,
        clearError,
    };
}
