import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { authFetch } from "@/lib/auth-client";
import { useAuthSession } from "@/hooks/useAuthSession";

interface AdminProtectedRouteProps {
    children: ReactNode;
    redirectTo: string;
}

function AccessFallback() {
    return (
        <div className="min-h-[40vh] flex items-center justify-center text-ink-2 text-sm">
            Verificando acceso...
        </div>
    );
}

function ConcealedRoute() {
    return (
        <div className="min-h-[40vh] flex items-center justify-center lam-mono">
            Recurso no disponible.
        </div>
    );
}

export function AdminProtectedRoute({ children, redirectTo }: AdminProtectedRouteProps) {
    const location = useLocation();
    const { loading, user } = useAuthSession();
    const [surfaceCheck, setSurfaceCheck] = useState<{ userId: number; allowed: boolean } | null>(null);
    const needsVpnCheck = user?.role === "admin";
    const vpnReady = needsVpnCheck
        ? (surfaceCheck?.userId === user.id ? surfaceCheck.allowed : null)
        : false;

    useEffect(() => {
        if (!user || user.role !== "admin") {
            return;
        }

        let active = true;
        const adminUserId = user.id;

        async function verifyAdminSurface() {
            try {
                const response = await authFetch("/auth/admin-surface");
                if (!active) return;
                setSurfaceCheck({ userId: adminUserId, allowed: response.ok });
            } catch {
                if (active) {
                    setSurfaceCheck({ userId: adminUserId, allowed: false });
                }
            }
        }

        void verifyAdminSurface();
        return () => {
            active = false;
        };
    }, [user]);

    if (loading || (needsVpnCheck && vpnReady === null)) {
        return <AccessFallback />;
    }

    if (!user) {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate to={`${redirectTo}?next=${next}`} replace />;
    }

    if (user.role !== "admin") {
        return <ConcealedRoute />;
    }

    if (!vpnReady) {
        return <ConcealedRoute />;
    }

    return <>{children}</>;
}
