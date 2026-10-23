/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { telemetryService } from "@/lib/telemetry-service";

export default function NotFound() {
    const location = useLocation();

    useEffect(() => {
        const path = `${location.pathname}${location.search}${location.hash}`;
        void telemetryService.trackInvalidNavigation({
            path,
            referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            route_scope: "frontend",
        });
    }, [location.hash, location.pathname, location.search]);

    return (
        <main className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-2xl border-t-2 border-rule bg-paper pt-8 sm:pt-10 text-ink">
                <span className="lam-stamp !border-vigencia !text-vigencia">Ruta no válida</span>

                <h1 className="lam-h1 mt-6">404 <span className="light">no encontrada</span></h1>
                <p className="mt-3 text-ink-2">
                    La URL solicitada no existe en EDUmind MiApp. Ya hemos registrado esta navegación
                    para mejorar rutas y enlaces.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                        to="/"
                        className="lam-btn lam-btn-block"
                    >
                        Ir al inicio
                    </Link>
                    <Link
                        to="/dashboard"
                        className="lam-btn lam-btn-block lam-btn-ghost"
                    >
                        Ir al panel
                    </Link>
                </div>

                <p className="mt-6 text-xs text-ink-2">
                    Ruta solicitada: <code className="font-mono bg-paper-2 px-1.5 py-0.5">{location.pathname}</code>
                </p>
            </div>
        </main>
    );
}
