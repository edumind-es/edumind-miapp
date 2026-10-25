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

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import {
    authFetch,
    clearLegacyAuthState,
    fetchAuthConfig,
    fetchDefaultDestination,
    startSsoLogin,
    type AuthConfig,
} from "@/lib/auth-client";
import { useAuthSession } from "@/hooks/useAuthSession";

function sanitizeNextPath(rawNext: string | null): string {
    if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.startsWith("/api/")) {
        return "/dashboard";
    }
    return rawNext;
}

async function resolveDefaultRedirect(): Promise<string> {
    const { path } = await fetchDefaultDestination();
    return path || "/dashboard";
}

function getPostLoginHint(nextPath: string): string {
    if (nextPath && nextPath !== "/dashboard") {
        return "Tras acceder volverás automáticamente al apartado solicitado.";
    }
    return "Tras acceder continuarás en tu panel de trabajo.";
}

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<AuthConfig | null>(null);
    const [configLoading, setConfigLoading] = useState(true);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshSession, user, loading: sessionLoading } = useAuthSession();

    const nextPath = useMemo(
        () => sanitizeNextPath(searchParams.get("next")),
        [searchParams],
    );

    // Llegada desde una ruta protegida tras un 401: se explica por qué se pide identificarse de nuevo.
    useEffect(() => {
        if (searchParams.get("reason") === "expired") {
            setError("Tu sesión ha caducado. Identifícate de nuevo para continuar.");
        }
    }, [searchParams]);
    const postLoginHint = useMemo(() => getPostLoginHint(nextPath), [nextPath]);

    useEffect(() => {
        let active = true;
        async function loadConfig() {
            try {
                const nextConfig = await fetchAuthConfig();
                if (active) {
                    setConfig(nextConfig);
                }
            } catch (loadError) {
                console.error("Auth config failed", loadError);
                if (active) {
                    setError("No se pudo cargar la configuración de acceso.");
                }
            } finally {
                if (active) {
                    setConfigLoading(false);
                }
            }
        }

        void loadConfig();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (sessionLoading || !user) {
            return;
        }

        let active = true;

        async function resolveRedirectTarget() {
            try {
                const destination = nextPath || await resolveDefaultRedirect();
                if (active) {
                    navigate(destination, { replace: true });
                }
            } catch (error) {
                console.error("Default redirect resolution failed", error);
                if (active) {
                    navigate("/dashboard", { replace: true });
                }
            }
        }

        void resolveRedirectTarget();
        return () => {
            active = false;
        };
    }, [navigate, nextPath, sessionLoading, user]);

    const getErrorMessage = (caught: unknown): string =>
        caught instanceof Error ? caught.message : "No se pudo iniciar sesión";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", password);

            const response = await authFetch("/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.detail || "Credenciales incorrectas");
            }

            clearLegacyAuthState();

            const currentUser = await refreshSession();
            if (!currentUser) {
                throw new Error("No se pudo validar la sesión tras el acceso.");
            }

            const destination = nextPath || await resolveDefaultRedirect();
            navigate(destination);
        } catch (caught: unknown) {
            setError(getErrorMessage(caught));
        } finally {
            setLoading(false);
        }
    };

    const handleSsoLogin = () => {
        startSsoLogin(nextPath);
    };

    const localLoginEnabled = config?.local_login_enabled ?? true;
    const ssoEnabled = config?.sso_enabled ?? false;

    return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
                <div className="mb-8">
                    <p className="lam-eyebrow mb-3">EDUmind · Acceso</p>
                    <h1 className="lam-h1 mb-4">Accede a <span className="light">EDUmind</span></h1>
                    <p className="lam-lede">
                        Identifícate para continuar en tu espacio de trabajo.
                    </p>
                </div>

                <div className="border-2 border-ink bg-card p-8">
                    {error ? (
                        <div className="lam-note alert mb-6">
                            <span className="tag">Error</span>
                            <p className="m-0 text-sm">{error}</p>
                        </div>
                    ) : null}

                    {configLoading ? (
                        <div className="lam-mono py-5">
                            Preparando acceso seguro...
                        </div>
                    ) : null}

                    {!configLoading && ssoEnabled ? (
                        <div className="lam-note mental">
                            <div className="flex items-start gap-3">
                                <div className="flex-1">
                                    <span className="tag">Acceso seguro</span>
                                    <p className="mt-1 text-sm leading-6 text-ink-2">
                                        Usa tu cuenta EDUmind para continuar. Cuando la sesión quede validada,
                                        volverás automáticamente a la aplicación.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleSsoLogin}
                                        className="mt-4 lam-btn lam-btn-sm"
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {!configLoading && localLoginEnabled ? (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            <div>
                                <label className="lam-label">
                                    Usuario
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="lam-input"
                                        placeholder="admin"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="lam-label">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="lam-input"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="lam-btn lam-btn-block"
                            >
                                {loading ? "Iniciando sesión..." : "Acceder con credenciales locales"}
                            </button>
                        </form>
                    ) : null}

                    {!configLoading && !ssoEnabled && !localLoginEnabled ? (
                        <div className="mt-6 border lam-note vigencia text-sm">
                            No hay un método de acceso habilitado en esta instancia. Revisa la configuración de autenticación.
                        </div>
                    ) : null}

                    <div className="mt-6 flex items-center justify-between border-t border-hair pt-5 text-sm">
                        <Link to="/" className="text-ink-2 transition hover:text-ink">
                            Volver al inicio
                        </Link>
                        <span className="text-ink-3">
                            {postLoginHint}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
