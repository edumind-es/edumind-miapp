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

// Panel de administración en modo EDUmind-Lámina: métricas como cifras grandes
// separadas por filetes, sin tarjetas ni iconos.

import { useState, useEffect } from "react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";
import { buildAdminPortalPath } from "@/lib/admin-portal";

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

function Stat({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
    return (
        <div className="border-t border-hair pt-3">
            <p className="lam-mono mb-2">{label}</p>
            <p className="m-0 font-extrabold text-[32px] leading-none tracking-[-0.03em]">{value}</p>
            {subtext ? <p className="m-0 mt-2 text-sm text-ink-2">{subtext}</p> : null}
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
                throw new Error("No se pudieron cargar las estadísticas.");
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
                    <span className="lam-mono">Cargando</span>
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout>
                <div className="lam-note alert">
                    <span className="tag">Error</span>
                    <p className="m-0">{error}</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-12">
                <div>
                    <p className="lam-eyebrow mb-3">EDUmind · Administración</p>
                    <h1 className="lam-h1 mb-4">
                        Panel <span className="light">de control</span>
                    </h1>
                    <p className="lam-lede">Estado de MiApp: usuarios, dataset y entrenamiento.</p>
                </div>

                <section>
                    <div className="lam-sec-head">
                        <span className="lam-sec-num">01</span>
                        <h2>Cifras</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
                        <Stat label="Usuarios" value={stats?.total_users || 0} subtext={`${stats?.active_users_today || 0} activos hoy`} />
                        <Stat label="Items de dataset" value={stats?.total_training_items || 0} subtext={`${stats?.verified_items || 0} verificados`} />
                        <Stat label="Documentos" value={stats?.total_documents || 0} />
                        <Stat label="Generaciones hoy" value={stats?.generations_today || 0} />
                        <Stat label="Jobs de entrenamiento" value={stats?.total_training_jobs || 0} />
                        <Stat label="Último modelo" value={stats?.latest_model_version || "Sin entrenar"} />
                        <Stat label="Items pendientes" value={stats?.pending_items || 0} subtext="Por verificar" />
                    </div>
                </section>

                <section>
                    <div className="lam-sec-head">
                        <span className="lam-sec-num">02</span>
                        <h2>Acciones</h2>
                    </div>
                    <ul className="lam-rules">
                        <li>
                            <span className="dash">—</span>
                            <a href={buildAdminPortalPath("/dataset")} className="flex-1 hover:underline underline-offset-4">Subir archivos al dataset</a>
                        </li>
                        <li>
                            <span className="dash">—</span>
                            <a href={buildAdminPortalPath("/dataset")} className="flex-1 hover:underline underline-offset-4">Verificar items pendientes</a>
                        </li>
                        <li>
                            <span className="dash">—</span>
                            <a href={buildAdminPortalPath("/training")} className="flex-1 hover:underline underline-offset-4">Preparar un entrenamiento</a>
                        </li>
                    </ul>
                </section>
            </div>
        </AdminLayout>
    );
}
