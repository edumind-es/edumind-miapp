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

import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Database,
    Cpu,
    Users,
    Settings,
    FileText,
    LogOut,
    Menu,
    X
} from "lucide-react";
import { authFetch, clearLegacyAuthState } from "@/lib/auth-client";
import { ADMIN_PORTAL_PATH, buildAdminPortalPath } from "@/lib/admin-portal";
import { useAuthSession } from "@/hooks/useAuthSession";

interface AdminLayoutProps {
    children: ReactNode;
}

const NAV_ITEMS = [
    { path: ADMIN_PORTAL_PATH, icon: LayoutDashboard, label: "Dashboard" },
    { path: buildAdminPortalPath("/dataset"), icon: Database, label: "Dataset Builder" },
    { path: buildAdminPortalPath("/training"), icon: Cpu, label: "Training Pipeline" },
    { path: buildAdminPortalPath("/users"), icon: Users, label: "Usuarios" },
    { path: buildAdminPortalPath("/config"), icon: Settings, label: "Configuración" },
    { path: buildAdminPortalPath("/logs"), icon: FileText, label: "Logs" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
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
        <div className="flex h-screen bg-[#0f1117]">
            {/* Sidebar */}
            <aside
                className={`${sidebarOpen ? "w-64" : "w-20"
                    } bg-[#1a1f2e] border-r border-white/10 flex flex-col transition-all duration-300`}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    {sidebarOpen && (
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            EDUmind Admin
                        </h1>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        {sidebarOpen ? (
                            <X className="w-5 h-5 text-slate-400" />
                        ) : (
                            <Menu className="w-5 h-5 text-slate-400" />
                        )}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {NAV_ITEMS.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                        : "text-slate-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {sidebarOpen && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/10">
                    {sidebarOpen && user?.username && (
                        <div className="mb-4 px-4 py-2 bg-white/5 rounded-lg">
                            <p className="text-sm text-slate-400">Logged in as</p>
                            <p className="text-white font-medium">{user.username}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {sidebarOpen && <span>Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
