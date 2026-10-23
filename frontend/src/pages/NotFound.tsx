/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Compass, Home } from "lucide-react";

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
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-10 text-slate-100 shadow-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    <AlertTriangle size={14} />
                    Ruta no válida
                </div>

                <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">404 | Página no encontrada</h1>
                <p className="mt-3 text-slate-300">
                    La URL solicitada no existe en EDUmind MiApp. Ya hemos registrado esta navegación
                    para mejorar rutas y enlaces.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold hover:bg-blue-500 transition-colors"
                    >
                        <Home size={16} />
                        Ir al inicio
                    </Link>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-semibold hover:bg-white/10 transition-colors"
                    >
                        <Compass size={16} />
                        Ir al dashboard
                    </Link>
                </div>

                <p className="mt-6 text-xs text-slate-400">
                    Ruta solicitada: <code className="text-slate-200">{location.pathname}</code>
                </p>
            </div>
        </main>
    );
}
