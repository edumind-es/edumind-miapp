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

// Layout de administración en modo EDUmind-Lámina: barra superior en papel con
// filete de 2px, enlaces mono y estado activo por inversión de tinta. Sin iconos.

import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authFetch, clearLegacyAuthState } from "@/lib/auth-client";
import { ADMIN_PORTAL_PATH, buildAdminPortalPath } from "@/lib/admin-portal";
import { useAuthSession } from "@/hooks/useAuthSession";

interface AdminLayoutProps {
    children: ReactNode;
}

const NAV_ITEMS = [
    { path: ADMIN_PORTAL_PATH, label: "Panel" },
    { path: buildAdminPortalPath("/dataset"), label: "Dataset" },
    { path: buildAdminPortalPath("/training"), label: "Entrenamiento" },
    { path: buildAdminPortalPath("/users"), label: "Usuarios" },
    { path: buildAdminPortalPath("/config"), label: "Configuración" },
    { path: buildAdminPortalPath("/logs"), label: "Logs" },
];

const linkBase =
    "font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-transparent transition-colors duration-150";
const linkIdle = `${linkBase} text-ink-2 hover:text-ink hover:border-ink`;
const linkActive = `${linkBase} bg-ink text-paper border-ink`;

export function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { clearSessionState, user } = useAuthSession();

    const handleLogout = async () => {
        let logoutUrl: string | null = null;
        try {
            const response = await authFetch("/auth/logout", { method: "POST" });
            if (response.ok) {
                const payload = await response.json() as { logout_url?: string | null };
                logoutUrl = payload.logout_url || null;
            }
        } catch (error) {
            console.error("Logout failed", error);
        }
        clearSessionState();
        clearLegacyAuthState();
        if (logoutUrl) {
            window.location.assign(logoutUrl);
            return;
        }
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-paper text-ink flex flex-col">
            <header className="sticky top-0 z-40 bg-paper">
                <div className="worlds-bar" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                <nav className="border-b-2 border-rule" aria-label="Administración">
                    <div className="lam-wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                        <Link to={ADMIN_PORTAL_PATH} className="lam-mono lam-mono-ink">
                            EDUmind <span className="text-ink-3">·</span> Administración
                        </Link>
                        <div className="flex flex-wrap items-center gap-1">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={location.pathname === item.path ? linkActive : linkIdle}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 pl-4 border-l border-hair">
                            {user?.username ? <span className="lam-mono lam-mono-ink">{user.username}</span> : null}
                            <button type="button" onClick={handleLogout} className={linkIdle}>
                                Salir
                            </button>
                        </div>
                    </div>
                </nav>
            </header>

            <main className="flex-1">
                <div className="lam-wrap py-10">{children}</div>
            </main>
        </div>
    );
}
