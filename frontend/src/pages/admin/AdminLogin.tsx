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
import { AlertCircle, ArrowRight, Lock, Shield, User } from "lucide-react";

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
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 shadow-lg shadow-cyan-900/30">
                        <Shield className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Accede a EDUmind</h1>
                    <p className="mt-2 text-slate-400">
                        Identifícate para continuar en tu espacio de trabajo.
                    </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#151a26] p-8 shadow-2xl shadow-black/20">
                    {error ? (
                        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    ) : null}

                    {configLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center text-sm text-slate-300">
                            Preparando acceso seguro...
                        </div>
                    ) : null}

                    {!configLoading && ssoEnabled ? (
                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-full bg-cyan-400/15 p-2">
                                    <Shield className="h-4 w-4 text-cyan-200" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">
                                        Acceso seguro
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-cyan-100/85">
                                        Usa tu cuenta EDUmind para continuar. Cuando la sesión quede validada,
                                        volverás automáticamente a la aplicación.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleSsoLogin}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                                    >
                                        Continuar
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {!configLoading && localLoginEnabled ? (
                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            <div>
                                <label className="mb-2 block text-sm text-slate-400">
                                    Usuario
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/30"
                                        placeholder="admin"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm text-slate-400">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/30"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Iniciando sesión..." : "Acceder con credenciales locales"}
                            </button>
                        </form>
                    ) : null}

                    {!configLoading && !ssoEnabled && !localLoginEnabled ? (
                        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                            No hay un método de acceso habilitado en esta instancia. Revisa la configuración de autenticación.
                        </div>
                    ) : null}

                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
                        <Link to="/" className="text-slate-400 transition hover:text-white">
                            Volver al inicio
                        </Link>
                        <span className="text-slate-500">
                            {postLoginHint}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
