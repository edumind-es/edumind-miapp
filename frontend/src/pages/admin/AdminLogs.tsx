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

import { useCallback, useEffect, useState } from "react";

import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";

interface NavigationMetricItem {
    key: string;
    count: number;
}

interface InvalidNavigationEvent {
    created_at: string;
    path: string;
    referrer?: string | null;
    ip_address?: string | null;
    user_id?: number | null;
}

interface InvalidNavigationMetrics {
    window_days: number;
    total_events: number;
    unique_paths: number;
    unique_referrers: number;
    top_paths: NavigationMetricItem[];
    top_referrers: NavigationMetricItem[];
    recent_events: InvalidNavigationEvent[];
    runtime_invalid_total: number;
}

interface ActivityLogEntry {
    id: number;
    user_id?: number | null;
    username?: string | null;
    action: string;
    resource_type?: string | null;
    resource_id?: number | null;
    details?: string | null;
    ip_address?: string | null;
    created_at: string;
}

function StatCard({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent: string;
}) {
    return (
        <div className="border-t border-hair pt-3">
            <p className="lam-mono">{label}</p>
            <p className={`font-extrabold text-[32px] tracking-[-0.03em] mt-1 ${accent}`}>{value}</p>
        </div>
    );
}

function formatTs(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

export default function AdminLogs() {
    const [days, setDays] = useState(7);
    const [actionFilter, setActionFilter] = useState("");
    const [logLimit, setLogLimit] = useState(40);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [metrics, setMetrics] = useState<InvalidNavigationMetrics | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

    const fetchMetrics = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError("");

            const logsQuery = new URLSearchParams({
                limit: String(logLimit),
            });
            if (actionFilter.trim()) {
                logsQuery.set("action", actionFilter.trim());
            }

            const [metricsResponse, logsResponse] = await Promise.all([
                authFetch(`/api/v1/admin/navigation-invalid-metrics?days=${days}&limit=12`),
                authFetch(`/api/v1/admin/logs?${logsQuery.toString()}`),
            ]);

            if (!metricsResponse.ok) {
                throw new Error("No se pudieron cargar las métricas de navegación inválida");
            }
            if (!logsResponse.ok) {
                throw new Error("No se pudieron cargar los logs de actividad");
            }

            const metricsData = (await metricsResponse.json()) as InvalidNavigationMetrics;
            const logsData = (await logsResponse.json()) as ActivityLogEntry[];
            setMetrics(metricsData);
            setActivityLogs(logsData);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error desconocido";
            setError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [actionFilter, days, logLimit]);

    useEffect(() => {
        void fetchMetrics();
    }, [fetchMetrics]);

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-[26px] font-bold tracking-[-0.02em]">Telemetría de Navegación Inválida</h1>
                        <p className="text-ink-2">
                            Métricas de rutas 404 para detectar enlaces rotos y mejorar UX.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="lam-mono">Ventana</label>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="lam-input !px-2 !py-1.5 text-sm"
                        >
                            <option value={1}>24h</option>
                            <option value={7}>7 días</option>
                            <option value={30}>30 días</option>
                        </select>
                        <label className="lam-mono">Acción</label>
                        <input
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            placeholder="navigation_invalid"
                            className="w-40 lam-input !px-2 !py-1.5 text-sm"
                        />
                        <label className="lam-mono">Límite</label>
                        <select
                            value={logLimit}
                            onChange={(e) => setLogLimit(Number(e.target.value))}
                            className="lam-input !px-2 !py-1.5 text-sm"
                        >
                            <option value={20}>20</option>
                            <option value={40}>40</option>
                            <option value={80}>80</option>
                        </select>
                        <button
                            onClick={() => void fetchMetrics(true)}
                            disabled={loading || refreshing}
                            className="lam-btn lam-btn-sm"
                        >
                            Actualizar
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <span className="lam-mono">Cargando</span>
                    </div>
                ) : null}

                {error ? (
                    <div className="lam-note alert flex items-center gap-3">
                        <span className="text-alert">{error}</span>
                    </div>
                ) : null}

                {metrics && !loading ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="Eventos Totales" value={metrics.total_events} accent="text-ink" />
                            <StatCard label="Rutas Únicas" value={metrics.unique_paths} accent="text-ink" />
                            <StatCard
                                label="Referrers Únicos"
                                value={metrics.unique_referrers}
                                accent="text-ok"
                            />
                            <StatCard
                                label="Contador Runtime"
                                value={metrics.runtime_invalid_total}
                                accent="text-vigencia"
                            />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <section className="lam-panel">
                                <h2 className="text-[17px] font-bold mb-3">
                                    Top rutas inválidas
                                </h2>
                                <div className="space-y-2">
                                    {metrics.top_paths.length === 0 ? (
                                        <p className="text-sm text-ink-3">Sin datos en esta ventana.</p>
                                    ) : (
                                        metrics.top_paths.map((item) => (
                                            <div
                                                key={item.key}
                                                className="flex items-center justify-between text-sm border-b border-hair px-0 py-2"
                                            >
                                                <code className="text-ink truncate pr-4">{item.key}</code>
                                                <span className="text-ink font-semibold">{item.count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            <section className="lam-panel">
                                <h2 className="text-[17px] font-bold mb-3">
                                    Top referrers
                                </h2>
                                <div className="space-y-2">
                                    {metrics.top_referrers.length === 0 ? (
                                        <p className="text-sm text-ink-3">Sin datos en esta ventana.</p>
                                    ) : (
                                        metrics.top_referrers.map((item) => (
                                            <div
                                                key={item.key}
                                                className="flex items-center justify-between text-sm border-b border-hair px-0 py-2"
                                            >
                                                <code className="text-ink truncate pr-4">{item.key}</code>
                                                <span className="text-ok font-semibold">{item.count}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>

                        <section className="lam-panel">
                            <h2 className="text-[17px] font-bold mb-3">
                                Últimos eventos
                            </h2>

                            <div className="overflow-x-auto">
                                <table className="lam-table">
                                    <thead>
                                        <tr>
                                            <th className="pr-3">Fecha</th>
                                            <th className="pr-3">Ruta</th>
                                            <th className="pr-3">Referrer</th>
                                            <th className="">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {metrics.recent_events.length === 0 ? (
                                            <tr>
                                                <td className="py-3 text-ink-3" colSpan={4}>
                                                    No hay eventos en esta ventana.
                                                </td>
                                            </tr>
                                        ) : (
                                            metrics.recent_events.map((event, idx) => (
                                                <tr key={`${event.created_at}-${idx}`} className="border-b border-hair">
                                                    <td className="py-2 pr-3 text-ink-2">{formatTs(event.created_at)}</td>
                                                    <td className="py-2 pr-3">
                                                        <code className="text-ink">{event.path}</code>
                                                    </td>
                                                    <td className="py-2 pr-3 text-ink-2">{event.referrer || "(direct)"}</td>
                                                    <td className="py-2 text-ink-2">{event.ip_address || "-"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="lam-panel">
                            <h2 className="text-[17px] font-bold mb-3">
                                Logs de actividad backend
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="lam-table">
                                    <thead>
                                        <tr>
                                            <th className="pr-3">Fecha</th>
                                            <th className="pr-3">Usuario</th>
                                            <th className="pr-3">Acción</th>
                                            <th className="pr-3">Recurso</th>
                                            <th className="">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activityLogs.length === 0 ? (
                                            <tr>
                                                <td className="py-3 text-ink-3" colSpan={5}>
                                                    No hay logs para los filtros seleccionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            activityLogs.map((item) => (
                                                <tr key={item.id} className="border-b border-hair">
                                                    <td className="py-2 pr-3 text-ink-2">{formatTs(item.created_at)}</td>
                                                    <td className="py-2 pr-3 text-ink-2">
                                                        {item.username || item.user_id || "anónimo"}
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <code className="text-alert">{item.action}</code>
                                                    </td>
                                                    <td className="py-2 pr-3 text-ink-2">
                                                        {item.resource_type || "-"}
                                                        {item.resource_id ? ` #${item.resource_id}` : ""}
                                                    </td>
                                                    <td className="py-2 text-ink-2">{item.ip_address || "-"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
}
