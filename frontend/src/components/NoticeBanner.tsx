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

// Aviso en modo EDUmind-Lámina: nota con filete izquierdo del color de señal y
// etiqueta mono. Sin iconos, sin radios.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "success" | "warning" | "error";

interface NoticeBannerProps {
    variant?: NoticeVariant;
    message: ReactNode;
    className?: string;
    actionLabel?: string;
    onAction?: () => void;
    onClose?: () => void;
}

const STYLES: Record<NoticeVariant, { note: string; tag: string }> = {
    info: { note: "mental", tag: "Aviso" },
    success: { note: "ok", tag: "Hecho" },
    warning: { note: "vigencia", tag: "Atención" },
    error: { note: "alert", tag: "Error" },
};

export function NoticeBanner({
    variant = "info",
    message,
    className,
    actionLabel,
    onAction,
    onClose,
}: NoticeBannerProps) {
    const style = STYLES[variant];

    return (
        <div className={cn("lam-note", style.note, className)} role={variant === "error" ? "alert" : "status"}>
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <span className="tag">{style.tag}</span>
                    <div className="text-[15px] leading-6">{message}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {actionLabel && onAction ? (
                        <button type="button" onClick={onAction} className="lam-btn lam-btn-sm lam-btn-ghost">
                            {actionLabel}
                        </button>
                    ) : null}
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="lam-mono lam-mono-ink px-1 hover:underline underline-offset-4"
                            aria-label="Cerrar aviso"
                        >
                            Cerrar
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
