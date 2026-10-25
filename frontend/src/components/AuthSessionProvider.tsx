/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
    clearLegacyAuthState,
    fetchCurrentUser,
    type SessionUser,
} from "@/lib/auth-client";
import { onSessionExpired } from "@/lib/auth-events";
import { fetchTeacherProfile, invalidateProfileCache } from "@/lib/profile-service";
import { AuthSessionContext } from "@/hooks/useAuthSession";

// Rutas que no tienen sentido sin sesión (las herramientas públicas no están aquí).
const PROTECTED_PREFIXES = ["/classroom", "/planner", "/tools/planning", "/admin"];

export function AuthSessionProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);

    async function refreshSession() {
        setLoading(true);
        try {
            const currentUser = await fetchCurrentUser();
            setUser(currentUser);
            if (!currentUser) {
                clearLegacyAuthState();
                invalidateProfileCache();
            } else {
                // Prellena la matriz curricular preferida antes de que el docente abra una herramienta.
                void fetchTeacherProfile().catch(() => undefined);
            }
            return currentUser;
        } catch (error) {
            console.error("Session bootstrap failed", error);
            setUser(null);
            clearLegacyAuthState();
            return null;
        } finally {
            setLoading(false);
        }
    }

    function clearSessionState() {
        setUser(null);
        clearLegacyAuthState();
        invalidateProfileCache();
    }

    useEffect(() => {
        void refreshSession();
    }, []);

    // F-05: cuando cualquier petición devuelve 401, la sesión se da por caducada en toda la app.
    // En rutas que exigen sesión se vuelve al login conservando el destino; en el resto basta con
    // limpiar el estado (las herramientas anónimas siguen funcionando).
    const location = useLocation();
    const navigate = useNavigate();
    const locationRef = useRef(location);
    locationRef.current = location;
    useEffect(() => {
        return onSessionExpired(() => {
            setUser((current) => {
                if (!current) return current;
                clearLegacyAuthState();
                const { pathname, search } = locationRef.current;
                if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
                    const next = encodeURIComponent(`${pathname}${search}`);
                    navigate(`/login?next=${next}&reason=expired`, { replace: true });
                }
                return null;
            });
        });
    }, [navigate]);

    return (
        <AuthSessionContext.Provider
            value={{
                user,
                loading,
                refreshSession,
                clearSessionState,
            }}
        >
            {children}
        </AuthSessionContext.Provider>
    );
}
