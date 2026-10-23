/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { createContext, useContext } from "react";

import type { SessionUser } from "@/lib/auth-client";

export interface AuthSessionValue {
    user: SessionUser | null;
    loading: boolean;
    refreshSession: () => Promise<SessionUser | null>;
    clearSessionState: () => void;
}

export const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function useAuthSession() {
    const context = useContext(AuthSessionContext);
    if (!context) {
        throw new Error("useAuthSession must be used inside AuthSessionProvider");
    }
    return context;
}
