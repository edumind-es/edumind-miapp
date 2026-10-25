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

// Barra superior EDUmind-Lámina: franja de mundos, rótulo mono y filete de 2px.
// Estado activo = inversión de tinta. Sin iconos, sin radios, sin sombras.

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { toolSections } from "@/lib/tools-registry";
import { authFetch } from "@/lib/auth-client";

interface NavItem {
    path: string;
    label: string;
}

interface NavSection {
    section: string;
    items: NavItem[];
}

const PRIMARY_LINKS: NavItem[] = [
    { path: "/", label: "Inicio" },
    { path: "/chat", label: "Chat IA" },
    { path: "/dashboard", label: "Panel" },
];

// La navegación interna de administración queda fuera del menú público a propósito.
// Las herramientas salen del registro único (lib/tools-registry.ts).
const TOOL_SECTIONS: NavSection[] = toolSections().map((section) => ({
    section: section.label,
    items: section.tools.map((tool) => ({ path: tool.path, label: tool.navLabel })),
}));

// Solo con sesión iniciada: el aula no aparecía en ningún menú aunque estaba operativa.
const SIGNED_IN_LINKS: NavItem[] = [{ path: "/classroom", label: "Mis clases" }];

const linkBase =
    "font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-transparent transition-colors duration-150";
const linkIdle = `${linkBase} text-ink-2 hover:text-ink hover:border-ink`;
const linkActive = `${linkBase} bg-ink text-paper border-ink`;

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, clearSessionState } = useAuthSession();

    const handleLogout = async () => {
        try {
            await authFetch("/auth/logout", { method: "POST" });
        } finally {
            clearSessionState();
            navigate("/", { replace: true });
        }
    };

    const isActive = (path: string) => location.pathname === path;
    const toolsActive = location.pathname.startsWith("/tools/");

    return (
        <header className="sticky top-0 z-50 bg-paper">
            <div className="worlds-bar" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <nav className="border-b-2 border-rule" aria-label="Principal">
                <div className="lam-wrap flex items-center justify-between gap-4 h-14">
                    <Link to="/" className="lam-mono lam-mono-ink">
                        EDUmind <span className="text-ink-3">·</span> MiApp
                    </Link>

                    {/* Navegación de escritorio */}
                    <div className="hidden md:flex items-center gap-1">
                        {[...PRIMARY_LINKS, ...(user ? SIGNED_IN_LINKS : [])].map((link) => (
                            <Link key={link.path} to={link.path} className={isActive(link.path) ? linkActive : linkIdle}>
                                {link.label}
                            </Link>
                        ))}

                        <div className="relative group">
                            <button type="button" className={toolsActive ? linkActive : linkIdle} aria-haspopup="true">
                                Herramientas
                            </button>
                            <div className="absolute right-0 pt-2 w-[640px] max-w-[90vw] invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity duration-150">
                                <div className="bg-card border-2 border-ink p-5 grid grid-cols-3 gap-6">
                                    {TOOL_SECTIONS.map((section) => (
                                        <div key={section.section}>
                                            <div className="lam-mono mb-3 pb-2 border-b border-hair">{section.section}</div>
                                            <ul className="m-0 p-0 list-none">
                                                {section.items.map((item) => (
                                                    <li key={item.path}>
                                                        <Link
                                                            to={item.path}
                                                            className={`block py-1.5 text-[14px] leading-snug ${
                                                                isActive(item.path) ? "font-semibold" : "text-ink-2 hover:text-ink"
                                                            }`}
                                                        >
                                                            <span className="text-ink-3 mr-2">—</span>
                                                            {item.label}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sesión (escritorio) */}
                    <div className="hidden md:flex items-center gap-3 pl-4 border-l border-hair">
                        {user ? (
                            <>
                                <span className="lam-mono lam-mono-ink">{user.username}</span>
                                <button type="button" onClick={handleLogout} className={linkIdle}>
                                    Salir
                                </button>
                            </>
                        ) : (
                            <Link to="/login" className={isActive("/login") ? linkActive : linkIdle}>
                                Acceder
                            </Link>
                        )}
                    </div>

                    {/* Conmutador móvil */}
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`md:hidden ${isOpen ? linkActive : linkIdle}`}
                        aria-expanded={isOpen}
                    >
                        {isOpen ? "Cerrar" : "Menú"}
                    </button>
                </div>
            </nav>

            {/* Menú móvil */}
            {isOpen && (
                <div className="md:hidden bg-paper border-b-2 border-rule">
                    <div className="lam-wrap py-4">
                        <ul className="lam-rules">
                            {[...PRIMARY_LINKS, ...(user ? SIGNED_IN_LINKS : [])].map((link) => (
                                <li key={link.path}>
                                    <Link
                                        to={link.path}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex-1 ${isActive(link.path) ? "font-semibold" : "text-ink-2"}`}
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        {TOOL_SECTIONS.map((section) => (
                            <div key={section.section} className="mt-5">
                                <div className="lam-mono mb-1">{section.section}</div>
                                <ul className="lam-rules">
                                    {section.items.map((item) => (
                                        <li key={item.path}>
                                            <span className="dash">—</span>
                                            <Link
                                                to={item.path}
                                                onClick={() => setIsOpen(false)}
                                                className={`flex-1 ${isActive(item.path) ? "font-semibold" : "text-ink-2"}`}
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        <div className="mt-5 pt-4 border-t-2 border-rule flex items-center justify-between gap-3">
                            {user ? (
                                <>
                                    <span className="lam-mono lam-mono-ink">{user.username}</span>
                                    <button
                                        type="button"
                                        onClick={() => { setIsOpen(false); void handleLogout(); }}
                                        className="lam-btn lam-btn-sm lam-btn-ghost"
                                    >
                                        Salir
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" onClick={() => setIsOpen(false)} className="lam-btn lam-btn-sm">
                                    Acceder
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
