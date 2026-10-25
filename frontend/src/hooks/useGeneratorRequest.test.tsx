import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGeneratorRequest } from "./useGeneratorRequest";

describe("useGeneratorRequest", () => {
    it("acumula los trozos y termina sin error", async () => {
        const { result } = renderHook(() => useGeneratorRequest());
        await act(async () => {
            await result.current.runGeneration(async (onChunk) => {
                onChunk("Hola ");
                onChunk("mundo");
            });
        });
        expect(result.current.output).toBe("Hola mundo");
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("extrae el detalle de un error JSON del backend", async () => {
        const { result } = renderHook(() => useGeneratorRequest());
        await act(async () => {
            await result.current.runGeneration(async () => {
                throw new Error(JSON.stringify({ detail: "Faltan datos obligatorios" }));
            });
        });
        expect(result.current.error).toBe("Faltan datos obligatorios");
    });

    it("cancelar aborta la señal y no deja error", async () => {
        const { result } = renderHook(() => useGeneratorRequest());
        let seenSignal: AbortSignal | undefined;
        let promise: Promise<void> | undefined;
        act(() => {
            promise = result.current.runGeneration(
                (_onChunk, options) =>
                    new Promise<void>((_resolve, reject) => {
                        seenSignal = options?.signal;
                        options?.signal?.addEventListener("abort", () =>
                            reject(new DOMException("Generation aborted", "AbortError"))
                        );
                    })
            );
        });
        await waitFor(() => expect(result.current.loading).toBe(true));
        act(() => result.current.cancelGeneration());
        await act(async () => {
            await promise;
        });
        expect(seenSignal?.aborted).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });
});
