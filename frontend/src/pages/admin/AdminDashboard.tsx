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

import { useState, useEffect } from "react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";
import { buildAdminPortalPath } from "@/lib/admin-portal";
import {
    Users,
    Database,
    FileText,
    Cpu,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DashboardStats {
    total_users: number;
    active_users_today: number;
    total_training_items: number;
    verified_items: number;
    pending_items: number;
    total_documents: number;
    total_training_jobs: number;
    latest_model_version: string | null;
    generations_today: number;
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    subtext
}: {
    icon: LucideIcon;
    label: string;
    value: string | number;
    color: string;
    subtext?: string;
}) {
    return (
        <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-6">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-slate-400 mb-1">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                    {subtext && (
                        <p className="text-xs text-slate-500 mt-1">{subtext}</p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await authFetch("/admin/stats");

            if (!response.ok) {
                throw new Error("Failed to fetch stats");
            }

            const data = await response.json();
            setStats(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error cargando estadísticas");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400">{error}</span>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400">
                        Panel de control de EDUmind MiApp
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        icon={Users}
                        label="Usuarios"
                        value={stats?.total_users || 0}
                        color="bg-blue-600"
                        subtext={`${stats?.active_users_today || 0} activos hoy`}
                    />
                    <StatCard
                        icon={Database}
                        label="Items de Dataset"
                        value={stats?.total_training_items || 0}
                        color="bg-green-600"
                        subtext={`${stats?.verified_items || 0} verificados`}
                    />
                    <StatCard
                        icon={FileText}
                        label="Documentos"
                        value={stats?.total_documents || 0}
                        color="bg-purple-600"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Generaciones Hoy"
                        value={stats?.generations_today || 0}
                        color="bg-orange-600"
                    />
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard
                        icon={Cpu}
                        label="Jobs de Entrenamiento"
                        value={stats?.total_training_jobs || 0}
                        color="bg-pink-600"
                    />
                    <StatCard
                        icon={CheckCircle}
                        label="Último Modelo"
                        value={stats?.latest_model_version || "Sin entrenar"}
                        color="bg-teal-600"
                    />
                    <StatCard
                        icon={Clock}
                        label="Items Pendientes"
                        value={stats?.pending_items || 0}
                        color="bg-yellow-600"
                        subtext="Por verificar"
                    />
                </div>

                {/* Quick Actions */}
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Acciones Rápidas
                    </h2>
                    <div className="flex flex-wrap gap-4">
                        <a
                            href={buildAdminPortalPath("/dataset")}
                            className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
                        >
                            📁 Subir Archivos
                        </a>
                        <a
                            href={buildAdminPortalPath("/dataset")}
                            className="px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-600/30 transition-colors"
                        >
                            ✅ Verificar Items
                        </a>
                        <a
                            href={buildAdminPortalPath("/training")}
                            className="px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-colors"
                        >
                            🚀 Preparar Entrenamiento
                        </a>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
