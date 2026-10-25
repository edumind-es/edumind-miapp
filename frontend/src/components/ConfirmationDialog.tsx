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

// Diálogo de confirmación en modo EDUmind-Lámina: recuadro de papel con filete de
// tinta, botones mono. Sin animación de rebote ni sombra.

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationDialog({
    open,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    destructive = false,
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmationDialogProps) {
    const cancelRef = useRef<HTMLButtonElement>(null);

    // Accesibilidad: Escape cancela, el foco entra en el diálogo al abrirse y vuelve a donde estaba al cerrarse.
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        cancelRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busy) {
                event.preventDefault();
                onCancel();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            previous?.focus?.();
        };
    }, [open, busy, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            style={{ background: "rgba(23, 24, 26, 0.55)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
        >
            <div className="w-full max-w-md bg-paper border-2 border-ink p-6">
                <span className={cn("lam-mono", destructive && "text-alert")}>
                    {destructive ? "Acción irreversible" : "Confirmación"}
                </span>
                <h2 id="confirmation-dialog-title" className="mt-2 text-[22px] font-bold leading-tight">
                    {title}
                </h2>
                <div className="mt-3 text-[15px] leading-6 text-ink-2">{description}</div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="lam-btn lam-btn-sm lam-btn-ghost">
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={cn("lam-btn lam-btn-sm", destructive && "!bg-alert !border-alert")}
                    >
                        {busy ? "Procesando..." : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
