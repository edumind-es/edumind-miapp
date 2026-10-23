/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

type NoticeVariant = "info" | "success" | "warning" | "error";

interface NoticeBannerProps {
    variant?: NoticeVariant;
    message: ReactNode;
    className?: string;
    actionLabel?: string;
    onAction?: () => void;
    onClose?: () => void;
}

const STYLES: Record<
    NoticeVariant,
    {
        container: string;
        button: string;
        icon: typeof Info;
    }
> = {
    info: {
        container: "border-sky-500/30 bg-sky-500/10 text-sky-100",
        button: "border-sky-400/30 text-sky-100 hover:bg-sky-400/10",
        icon: Info,
    },
    success: {
        container: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        button: "border-emerald-400/30 text-emerald-100 hover:bg-emerald-400/10",
        icon: CheckCircle2,
    },
    warning: {
        container: "border-amber-500/30 bg-amber-500/10 text-amber-100",
        button: "border-amber-400/30 text-amber-100 hover:bg-amber-400/10",
        icon: TriangleAlert,
    },
    error: {
        container: "border-rose-500/30 bg-rose-500/10 text-rose-100",
        button: "border-rose-400/30 text-rose-100 hover:bg-rose-400/10",
        icon: AlertCircle,
    },
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
    const Icon = style.icon;

    return (
        <div className={cn("rounded-xl border px-4 py-3", style.container, className)}>
            <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1 text-sm leading-6">{message}</div>
                <div className="flex items-center gap-2">
                    {actionLabel && onAction ? (
                        <button
                            type="button"
                            onClick={onAction}
                            className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                style.button
                            )}
                        >
                            {actionLabel}
                        </button>
                    ) : null}
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md p-1 text-current/70 transition-colors hover:bg-white/10 hover:text-current"
                            aria-label="Cerrar aviso"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
