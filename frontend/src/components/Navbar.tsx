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

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Home, Wrench, MessageSquare, LogIn, LogOut, User } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authFetch } from "@/lib/auth-client";

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

    // Public navigation links only
    const navLinks = [
        { path: "/", label: "Inicio", icon: Home },
        { path: "/chat", label: "Chat IA", icon: MessageSquare },
        { path: "/dashboard", label: "Dashboard", icon: Wrench },
        {
            label: "Herramientas",
            icon: Wrench,
            submenu: [
                {
                    section: "Docentes", items: [
                        { path: "/tools/planning", label: "Planificación semanal" },
                        { path: "/tools/situation", label: "Situación de Aprendizaje" },
                        { path: "/tools/stem", label: "Proyecto STEM" },
                        { path: "/tools/diversity", label: "Atención Diversidad" },
                        { path: "/tools/reinforcement_plan", label: "Plan de Refuerzo" },
                        { path: "/tools/session", label: "Sesión" },
                    ]
                },
                {
                    section: "Opositores", items: [
                        { path: "/tools/topic", label: "Tema" },
                        { path: "/tools/case", label: "Supuesto Práctico" },
                        { path: "/tools/defense", label: "Defensa" },
                        { path: "/tools/idea", label: "Consulta Rápida" },
                    ]
                },
                {
                    section: "Centros", items: [
                        { path: "/tools/minutes", label: "Actas" },
                        { path: "/tools/institution_doc", label: "Doc. Institucional" },
                        { path: "/tools/inspection_report", label: "Inspección Educativa" },
                        { path: "/tools/reinforcement_plan", label: "Plan de Refuerzo" },
                    ]
                }
            ]
        },
        // Internal administration remains intentionally absent from public navigation.
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0e1a]/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    {/* Logo */}
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">E</span>
                            </div>
                            <span className="text-white font-bold text-lg hidden sm:block">EDUmind® AI</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link, idx) => {
                            if (link.submenu) {
                                return (
                                    <div key={idx} className="relative group">
                                        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                                            {link.icon && <link.icon className="w-4 h-4" />}
                                            {link.label}
                                        </button>

                                        {/* Dropdown */}
                                        <div className="absolute left-0 mt-2 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl p-4 grid grid-cols-3 gap-4">
                                                {link.submenu.map((section, sIdx) => (
                                                    <div key={sIdx}>
                                                        <h3 className="text-xs font-semibold text-slate-400 mb-2">{section.section}</h3>
                                                        <div className="space-y-1">
                                                            {section.items.map((item, iIdx) => (
                                                                <Link
                                                                    key={iIdx}
                                                                    to={item.path}
                                                                    className="block px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                                                                >
                                                                    {item.label}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            const Icon = link.icon;
                            return (
                                <Link
                                    key={idx}
                                    to={link.path!}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive(link.path!)
                                        ? "bg-white/10 text-white"
                                        : "text-slate-300 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {Icon && <Icon className="w-4 h-4" />}
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Session controls (desktop) */}
                    <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                        {user ? (
                            <>
                                <span className="flex items-center gap-1.5 text-sm text-slate-300 px-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    {user.username}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Salir
                                </button>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <LogIn className="w-4 h-4" />
                                Acceder
                            </Link>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden flex items-center">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden border-t border-white/10 bg-[#0a0e1a] relative z-[100]">
                    <div className="px-4 py-4 space-y-2">
                        {navLinks.map((link, idx) => {
                            if (link.submenu) {
                                return (
                                    <div key={idx} className="space-y-2">
                                        <div className="px-3 py-2 text-slate-400 text-sm font-medium">{link.label}</div>
                                        {link.submenu.map((section, sIdx) => (
                                            <div key={sIdx} className="ml-4 space-y-1">
                                                <div className="text-xs text-slate-500 font-semibold">{section.section}</div>
                                                {section.items.map((item, iIdx) => (
                                                    <Link
                                                        key={iIdx}
                                                        to={item.path}
                                                        onClick={() => setIsOpen(false)}
                                                        className="block px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                                                    >
                                                        {item.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                );
                            }

                            const Icon = link.icon;
                            return (
                                <Link
                                    key={idx}
                                    to={link.path!}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive(link.path!)
                                        ? "bg-white/10 text-white"
                                        : "text-slate-300 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {Icon && <Icon className="w-5 h-5" />}
                                    {link.label}
                                </Link>
                            );
                        })}

                        {/* Session controls (mobile) */}
                        <div className="pt-3 mt-1 border-t border-white/10">
                            {user ? (
                                <div className="flex items-center justify-between px-3 py-2">
                                    <span className="flex items-center gap-1.5 text-sm text-slate-300">
                                        <User className="w-4 h-4 text-slate-500" />
                                        {user.username}
                                    </span>
                                    <button
                                        onClick={() => { setIsOpen(false); void handleLogout(); }}
                                        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Salir
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    <LogIn className="w-4 h-4" />
                                    Acceder
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
