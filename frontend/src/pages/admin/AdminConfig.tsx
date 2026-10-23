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
import { AlertCircle, Download, Gauge, Plus, RefreshCw, Save, ServerCog, ShieldCheck } from "lucide-react";

import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";

interface ConfigItem {
    key: string;
    value: string;
}

interface QueueRuntimeStatus {
    backend?: string;
    configured_backend?: string;
    active_sessions?: number;
    max_concurrent_users?: number;
    timeout_seconds?: number;
    redis_state?: string;
}

interface NormativeRuntimeStatus {
    loaded?: boolean;
    indexed_sections?: number;
    cache_backend?: string;
    cache_entries?: number;
    redis_state?: string;
}

interface RequestMetrics {
    total?: number;
    errors?: Record<string, number>;
}

interface GeneratorMetrics {
    total?: number;
    by_provider?: Record<string, number>;
    outcomes_total?: Record<string, number>;
    outcomes_by_provider?: Record<string, Record<string, number>>;
    avg_latency_ms_by_provider?: Record<string, number>;
}

interface ProviderAlert {
    level?: string;
    code?: string;
    provider?: string;
    message?: string;
    metrics?: Record<string, number>;
    threshold?: Record<string, number>;
}

interface ProviderAlertPolicy {
    dns_error_count?: number;
    timeout_count?: number;
    min_sample_size?: number;
    failure_rate_percent?: number;
}

interface ProviderGuardOverride {
    force_disabled?: boolean;
    reason?: string;
}

interface ObservabilitySnapshot {
    queue?: QueueRuntimeStatus;
    training_queue?: {
        queued?: number;
        running?: number;
        failed?: number;
    };
    normative_retrieval?: NormativeRuntimeStatus;
    prompt_contracts_count?: number;
    metrics?: {
        requests?: RequestMetrics;
        navigation?: {
            invalid_total?: number;
        };
        generators?: GeneratorMetrics;
    };
    provider_alert_policy?: ProviderAlertPolicy;
    provider_alerts?: ProviderAlert[];
    provider_guard_overrides?: Record<string, ProviderGuardOverride>;
}

interface SloHealth {
    slo_targets: {
        availability_percent: number;
        p95_latency_ms: number;
    };
    current: {
        availability_percent: number;
        p95_latency_ms: number;
        total_requests: number;
        total_errors: number;
    };
    meets_slo: {
        availability: boolean;
        latency: boolean;
        overall: boolean;
    };
}

interface ProviderConnectivityItem {
    status: string;
    available: boolean;
    reason?: string | null;
    dns_ok?: boolean;
    tls_ok?: boolean;
    http_ok?: boolean;
    http_status?: number | null;
    auth_required?: boolean;
    connection_scope?: string;
    api_key_validated?: boolean;
    checked_at?: string;
}

interface ProvidersHealthResponse {
    timestamp: string;
    cached: boolean;
    providers: Record<string, ProviderConnectivityItem>;
}

function StatCard({
    title,
    value,
    helper,
}: {
    title: string;
    value: string;
    helper?: string;
}) {
    return (
        <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400">{title}</p>
            <p className="text-xl font-semibold text-white mt-1">{value}</p>
            {helper ? <p className="text-xs text-slate-500 mt-1">{helper}</p> : null}
        </div>
    );
}

export default function AdminConfig() {
    const [configs, setConfigs] = useState<ConfigItem[]>([]);
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

    const [observability, setObservability] = useState<ObservabilitySnapshot | null>(null);
    const [slo, setSlo] = useState<SloHealth | null>(null);
    const [providersHealth, setProvidersHealth] = useState<ProvidersHealthResponse | null>(null);

    const applyConfigs = useCallback((items: ConfigItem[]) => {
        const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key));
        setConfigs(sorted);
        setDraftValues(
            sorted.reduce<Record<string, string>>((acc, item) => {
                acc[item.key] = item.value;
                return acc;
            }, {})
        );
    }, []);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError("");
            setNotice("");

            const [cfgRes, obsRes, sloRes, providersRes] = await Promise.all([
                authFetch("/admin/config"),
                authFetch("/admin/observability"),
                authFetch("/health/slo"),
                authFetch(`/api/v1/health/providers${isRefresh ? "?refresh=true" : ""}`),
            ]);

            if (!cfgRes.ok) {
                throw new Error("No se pudo cargar la configuración del sistema");
            }

            const cfgData = (await cfgRes.json()) as ConfigItem[];
            applyConfigs(cfgData);

            if (obsRes.ok) {
                const obsData = (await obsRes.json()) as ObservabilitySnapshot;
                setObservability(obsData);
            } else {
                setObservability(null);
            }

            if (sloRes.ok) {
                const sloData = (await sloRes.json()) as SloHealth;
                setSlo(sloData);
            } else {
                setSlo(null);
            }

            if (providersRes.ok) {
                const providersData = (await providersRes.json()) as ProvidersHealthResponse;
                setProvidersHealth(providersData);
            } else {
                setProvidersHealth(null);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error cargando configuración";
            setError(message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [applyConfigs]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const saveConfig = async (key: string, value: string) => {
        if (!key.trim()) return;
        try {
            setSavingKey(key);
            setError("");
            setNotice("");

            const response = await authFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
            });

            if (!response.ok) {
                const payload = await response.text();
                throw new Error(payload || `No se pudo guardar la configuración ${key}`);
            }

            setNotice(`Configuración '${key}' actualizada`);
            await loadData(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error guardando configuración";
            setError(message);
        } finally {
            setSavingKey(null);
        }
    };

    const addConfig = async (event: React.FormEvent) => {
        event.preventDefault();
        const key = newKey.trim();
        if (!key) {
            setError("La clave de configuración no puede estar vacía");
            return;
        }
        await saveConfig(key, newValue);
        setNewKey("");
        setNewValue("");
    };

    const exportObservability = async (format: "json" | "csv") => {
        try {
            setExporting(format);
            const response = await authFetch(`/api/v1/admin/observability/export?format=${format}`);
            if (!response.ok) {
                throw new Error("No se pudo exportar observabilidad");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const disposition = response.headers.get("content-disposition") || "";
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || `edumind-observability.${format}`;

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error exportando observabilidad";
            setError(message);
        } finally {
            setExporting(null);
        }
    };

    const setProviderGuardState = async (provider: string, forceDisabled: boolean) => {
        const key = `observability.guard.provider.${provider}.force_disabled`;
        await saveConfig(key, forceDisabled ? "true" : "false");
    };

    const requestMetrics = observability?.metrics?.requests;
    const totalErrors = Object.values(requestMetrics?.errors || {}).reduce((sum, count) => sum + count, 0);
    const invalidNavigationTotal = observability?.metrics?.navigation?.invalid_total || 0;
    const generatorMetrics = observability?.metrics?.generators;
    const generationTotal = generatorMetrics?.total ?? 0;
    const generationByProvider = generatorMetrics?.by_provider || {};
    const outcomeTotals = generatorMetrics?.outcomes_total || {};
    const outcomesByProvider = generatorMetrics?.outcomes_by_provider || {};
    const avgLatencyByProvider = generatorMetrics?.avg_latency_ms_by_provider || {};
    const providerRows = Object.keys(generationByProvider).sort();

    const successCount = outcomeTotals.success ?? 0;
    const emptyCount = outcomeTotals.empty ?? 0;
    const timeoutCount = outcomeTotals.timeout ?? 0;
    const dnsErrorCount = outcomeTotals.dns_error ?? 0;
    const providerAlerts = observability?.provider_alerts || [];
    const alertPolicy = observability?.provider_alert_policy || {};
    const providerGuardOverrides = observability?.provider_guard_overrides || {};
    const edumindGuard = providerGuardOverrides.edumind;
    const providerConnectivityRows = Object.entries(providersHealth?.providers || {}).sort(([a], [b]) =>
        a.localeCompare(b)
    );

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Configuración y Observabilidad</h1>
                        <p className="text-slate-400">
                            Operación enterprise: configuración dinámica, SLO y estado runtime.
                        </p>
                    </div>

                    <button
                        onClick={() => void loadData(true)}
                        disabled={loading || refreshing}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Actualizar
                    </button>
                </div>

                {loading ? (
                    <div className="h-48 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    </div>
                ) : null}

                {error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-300 text-sm">{error}</span>
                    </div>
                ) : null}

                {notice ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-300 text-sm">{notice}</span>
                    </div>
                ) : null}

                {!loading ? (
                    <>
                        <section className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4 space-y-3">
                            <h2 className="text-white font-semibold flex items-center gap-2">
                                <ServerCog className="w-4 h-4 text-blue-300" />
                                Claves de configuración
                            </h2>

                            <form onSubmit={addConfig} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                <input
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="nueva_clave"
                                    className="md:col-span-4 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white"
                                />
                                <input
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    placeholder="valor"
                                    className="md:col-span-6 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white"
                                />
                                <button
                                    type="submit"
                                    className="md:col-span-2 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-2 text-sm font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    Añadir
                                </button>
                            </form>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-white/10">
                                            <th className="text-left py-2 pr-3">Clave</th>
                                            <th className="text-left py-2 pr-3">Valor</th>
                                            <th className="text-right py-2">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {configs.length === 0 ? (
                                            <tr>
                                                <td className="py-3 text-slate-500" colSpan={3}>
                                                    No hay claves configuradas.
                                                </td>
                                            </tr>
                                        ) : (
                                            configs.map((item) => (
                                                <tr key={item.key} className="border-b border-white/5">
                                                    <td className="py-2 pr-3">
                                                        <code className="text-blue-300">{item.key}</code>
                                                    </td>
                                                    <td className="py-2 pr-3">
                                                        <input
                                                            value={draftValues[item.key] ?? ""}
                                                            onChange={(e) =>
                                                                setDraftValues((prev) => ({
                                                                    ...prev,
                                                                    [item.key]: e.target.value,
                                                                }))
                                                            }
                                                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
                                                        />
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        <button
                                                            onClick={() =>
                                                                void saveConfig(item.key, draftValues[item.key] ?? "")
                                                            }
                                                            disabled={savingKey === item.key}
                                                            className="inline-flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-2.5 py-1.5 disabled:opacity-60"
                                                        >
                                                            <Save className="w-3.5 h-3.5" />
                                                            {savingKey === item.key ? "Guardando..." : "Guardar"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-white font-semibold flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-amber-300" />
                                Runtime y SLO
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <StatCard
                                    title="Queue backend"
                                    value={observability?.queue?.backend || "n/d"}
                                    helper={`cfg: ${observability?.queue?.configured_backend || "n/d"} | redis: ${observability?.queue?.redis_state || "n/d"}`}
                                />
                                <StatCard
                                    title="Sesiones activas"
                                    value={String(observability?.queue?.active_sessions ?? 0)}
                                    helper={`max: ${observability?.queue?.max_concurrent_users ?? 0} | ttl: ${observability?.queue?.timeout_seconds ?? 0}s`}
                                />
                                <StatCard
                                    title="Normativa indexada"
                                    value={String(observability?.normative_retrieval?.indexed_sections ?? 0)}
                                    helper={`cache: ${observability?.normative_retrieval?.cache_backend || "n/d"} (${observability?.normative_retrieval?.cache_entries ?? 0} entradas)`}
                                />
                                <StatCard
                                    title="Training queue"
                                    value={String(observability?.training_queue?.queued ?? 0)}
                                    helper={`running: ${observability?.training_queue?.running ?? 0} | failed: ${observability?.training_queue?.failed ?? 0}`}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <StatCard
                                    title="Requests totales"
                                    value={String(requestMetrics?.total ?? 0)}
                                    helper="capturados por middleware"
                                />
                                <StatCard
                                    title="Errores"
                                    value={String(totalErrors)}
                                    helper={`invalid nav: ${invalidNavigationTotal}`}
                                />
                                <StatCard
                                    title="Disponibilidad"
                                    value={`${slo?.current.availability_percent?.toFixed(2) || "0.00"}%`}
                                    helper={`objetivo: ${slo?.slo_targets.availability_percent || 0}%`}
                                />
                                <StatCard
                                    title="Latencia p95"
                                    value={`${slo?.current.p95_latency_ms?.toFixed(1) || "0.0"} ms`}
                                    helper={`objetivo: ${slo?.slo_targets.p95_latency_ms || 0} ms`}
                                />
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-slate-400">Cumplimiento SLO:</span>
                                <span
                                    className={`px-2 py-1 rounded ${
                                        slo?.meets_slo.availability
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : "bg-red-500/20 text-red-300"
                                    }`}
                                >
                                    Disponibilidad
                                </span>
                                <span
                                    className={`px-2 py-1 rounded ${
                                        slo?.meets_slo.latency
                                            ? "bg-emerald-500/20 text-emerald-300"
                                            : "bg-red-500/20 text-red-300"
                                    }`}
                                >
                                    Latencia
                                </span>
                                <span
                                    className={`px-2 py-1 rounded font-medium ${
                                        slo?.meets_slo.overall
                                            ? "bg-emerald-500/20 text-emerald-200"
                                            : "bg-red-500/20 text-red-200"
                                    }`}
                                >
                                    {slo?.meets_slo.overall ? "Objetivo global OK" : "Objetivo global NO OK"}
                                </span>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-white font-semibold flex items-center gap-2">
                                    <ServerCog className="w-4 h-4 text-cyan-300" />
                                    Diagnóstico Conectividad IA
                                </h2>
                                <div className="text-xs text-slate-400">
                                    {providersHealth ? (
                                        <>
                                            {providersHealth.cached ? "cache" : "live"} • {providersHealth.timestamp}
                                        </>
                                    ) : (
                                        "sin datos"
                                    )}
                                </div>
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-3 text-xs text-slate-300">
                                Test de red sin API key: valida DNS/TLS/HTTP y NO valida credenciales BYOK.
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-white/10">
                                            <th className="text-left py-2 pr-3">Proveedor</th>
                                            <th className="text-left py-2 pr-3">Estado</th>
                                            <th className="text-center py-2 pr-3">DNS</th>
                                            <th className="text-center py-2 pr-3">TLS</th>
                                            <th className="text-center py-2 pr-3">HTTP</th>
                                            <th className="text-center py-2 pr-3">Auth</th>
                                            <th className="text-left py-2 pr-3">Scope</th>
                                            <th className="text-left py-2">Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providerConnectivityRows.length === 0 ? (
                                            <tr>
                                                <td className="py-3 text-slate-500" colSpan={8}>
                                                    Sin diagnostico disponible.
                                                </td>
                                            </tr>
                                        ) : (
                                            providerConnectivityRows.map(([provider, item]) => (
                                                <tr key={provider} className="border-b border-white/5">
                                                    <td className="py-2 pr-3 text-slate-200">{provider}</td>
                                                    <td className="py-2 pr-3">
                                                        <span
                                                            className={`px-2 py-1 rounded text-xs ${
                                                                item.available
                                                                    ? "bg-emerald-500/20 text-emerald-300"
                                                                    : "bg-rose-500/20 text-rose-300"
                                                            }`}
                                                        >
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 pr-3 text-center text-slate-200">
                                                        {item.dns_ok ? "OK" : "KO"}
                                                    </td>
                                                    <td className="py-2 pr-3 text-center text-slate-200">
                                                        {item.tls_ok ? "OK" : "KO"}
                                                    </td>
                                                    <td className="py-2 pr-3 text-center text-slate-200">
                                                        {item.http_ok ? "OK" : "KO"}
                                                        {typeof item.http_status === "number"
                                                            ? ` (${item.http_status})`
                                                            : ""}
                                                    </td>
                                                    <td className="py-2 pr-3 text-center text-slate-200">
                                                        {item.auth_required ? "BYOK" : "N/A"}
                                                    </td>
                                                    <td className="py-2 pr-3 text-slate-300">
                                                        {item.connection_scope || "network-only"}
                                                    </td>
                                                    <td className="py-2 text-[12px] text-slate-400">
                                                        {item.reason || "Sin detalle"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h2 className="text-white font-semibold flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-sky-300" />
                                    Observabilidad por proveedor
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => void exportObservability("json")}
                                        disabled={exporting !== null}
                                        className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-60"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {exporting === "json" ? "Exportando..." : "Exportar JSON"}
                                    </button>
                                    <button
                                        onClick={() => void exportObservability("csv")}
                                        disabled={exporting !== null}
                                        className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-60"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        {exporting === "csv" ? "Exportando..." : "Exportar CSV"}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-3 text-xs text-slate-300 flex flex-wrap gap-3">
                                <span>DNS umbral: {alertPolicy.dns_error_count ?? 1}</span>
                                <span>Timeout umbral: {alertPolicy.timeout_count ?? 2}</span>
                                <span>Fallo umbral: {(alertPolicy.failure_rate_percent ?? 20).toFixed(1)}%</span>
                                <span>Muestra mínima: {alertPolicy.min_sample_size ?? 10}</span>
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-3 text-xs text-slate-200 space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <span>
                                        Guard operativo EDUmind:{" "}
                                        <strong className={edumindGuard?.force_disabled ? "text-rose-300" : "text-emerald-300"}>
                                            {edumindGuard?.force_disabled ? "FORZADO OFF" : "ACTIVO"}
                                        </strong>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => void setProviderGuardState("edumind", true)}
                                            disabled={savingKey === "observability.guard.provider.edumind.force_disabled"}
                                            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-60"
                                        >
                                            Forzar OFF
                                        </button>
                                        <button
                                            onClick={() => void setProviderGuardState("edumind", false)}
                                            disabled={savingKey === "observability.guard.provider.edumind.force_disabled"}
                                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1.5 rounded disabled:opacity-60"
                                        >
                                            Reactivar
                                        </button>
                                    </div>
                                </div>
                                {edumindGuard?.reason ? (
                                    <div className="text-[11px] text-amber-200">
                                        Motivo configurado: {edumindGuard.reason}
                                    </div>
                                ) : null}
                            </div>

                            {providerAlerts.length > 0 ? (
                                <div className="space-y-2">
                                    {providerAlerts.map((alert, index) => (
                                        <div
                                            key={`${alert.code || "alert"}-${alert.provider || "global"}-${index}`}
                                            className={`rounded-lg p-3 flex items-center gap-2 ${
                                                alert.level === "critical"
                                                    ? "bg-red-500/10 border border-red-500/30"
                                                    : "bg-amber-500/10 border border-amber-500/30"
                                            }`}
                                        >
                                            <AlertCircle
                                                className={`w-4 h-4 ${
                                                    alert.level === "critical" ? "text-red-300" : "text-amber-300"
                                                }`}
                                            />
                                            <span
                                                className={`text-sm ${
                                                    alert.level === "critical" ? "text-red-200" : "text-amber-200"
                                                }`}
                                            >
                                                {alert.message || "Alerta de proveedor"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-200">
                                    Sin alertas activas de conectividad/proveedor.
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                                <StatCard title="Generaciones" value={String(generationTotal)} helper="total backend" />
                                <StatCard title="Success" value={String(successCount)} helper="respuesta útil" />
                                <StatCard title="Empty" value={String(emptyCount)} helper="sin contenido útil" />
                                <StatCard title="Timeout" value={String(timeoutCount)} helper="agotó espera" />
                                <StatCard title="DNS error" value={String(dnsErrorCount)} helper="fallo resolución/red" />
                            </div>

                            <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-white/10">
                                            <th className="text-left py-2 pr-3">Proveedor</th>
                                            <th className="text-right py-2 pr-3">Req</th>
                                            <th className="text-right py-2 pr-3">Success</th>
                                            <th className="text-right py-2 pr-3">Empty</th>
                                            <th className="text-right py-2 pr-3">Timeout</th>
                                            <th className="text-right py-2 pr-3">DNS</th>
                                            <th className="text-right py-2 pr-3">Error</th>
                                            <th className="text-right py-2">Lat. media</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {providerRows.length === 0 ? (
                                            <tr>
                                                <td className="py-3 text-slate-500" colSpan={8}>
                                                    Sin tráfico de generación todavía.
                                                </td>
                                            </tr>
                                        ) : (
                                            providerRows.map((provider) => {
                                                const providerOutcomes = outcomesByProvider[provider] || {};
                                                const avgLatency = avgLatencyByProvider[provider];
                                                return (
                                                    <tr key={provider} className="border-b border-white/5">
                                                        <td className="py-2 pr-3 text-slate-200">{provider}</td>
                                                        <td className="py-2 pr-3 text-right text-white">
                                                            {generationByProvider[provider] ?? 0}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right text-emerald-300">
                                                            {providerOutcomes.success ?? 0}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right text-amber-300">
                                                            {providerOutcomes.empty ?? 0}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right text-orange-300">
                                                            {providerOutcomes.timeout ?? 0}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right text-red-300">
                                                            {providerOutcomes.dns_error ?? 0}
                                                        </td>
                                                        <td className="py-2 pr-3 text-right text-rose-300">
                                                            {providerOutcomes.provider_error ?? 0}
                                                        </td>
                                                        <td className="py-2 text-right text-slate-200">
                                                            {typeof avgLatency === "number"
                                                                ? `${avgLatency.toFixed(1)} ms`
                                                                : "n/d"}
                                                        </td>
                                                    </tr>
                                                );
                                            })
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
