/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: string[];
    redirectTo: string;
}

function AccessFallback() {
    return (
        <div className="min-h-[40vh] flex items-center justify-center text-slate-400 text-sm">
            Verificando acceso...
        </div>
    );
}

export function ProtectedRoute({
    children,
    allowedRoles,
    redirectTo,
}: ProtectedRouteProps) {
    const location = useLocation();
    const { loading, user } = useAuthSession();

    if (loading) {
        return <AccessFallback />;
    }

    if (!user) {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate to={`${redirectTo}?next=${next}`} replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
