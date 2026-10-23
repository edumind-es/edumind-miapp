/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useEffect, useState, type ReactNode } from "react";

import {
    clearLegacyAuthState,
    fetchCurrentUser,
    type SessionUser,
} from "@/lib/auth-client";
import { AuthSessionContext } from "@/hooks/useAuthSession";

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
    }

    useEffect(() => {
        void refreshSession();
    }, []);

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
