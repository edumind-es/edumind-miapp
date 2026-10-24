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
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-client";
import { detectDeviceCapability, type DeviceCapability } from "@/lib/device-capability";
import { rememberEngine } from "@/lib/engine-preference";

interface Engine {
    id: string;
    name: string;
    color: string;
    desc: string;
    tier?: string;
    requires_api_key?: boolean;
    requires_vpn_or_admin?: boolean;
    enabled?: boolean;
    reason_disabled?: string | null;
    is_default?: boolean;
}

const FALLBACK_ENGINES: Engine[] = [
    {
        id: "webgpu",
        name: "Tu Dispositivo",
        color: "bg-ok",
        desc: "Privado (WebGPU) - Gratis",
        tier: "local",
        requires_api_key: false,
        enabled: true,
        reason_disabled: null,
        is_default: true,
    },
];

interface RuntimePolicy {
    managed_public_enabled: boolean;
    queue_utilization: number;
    recommended_engine: string;
    provider_reliability?: Record<
        string,
        {
            status?: string;
            available?: boolean;
            reason?: string;
        }
    >;
}

interface ProviderHealthItem {
    status: string;
    available: boolean;
    reason?: string | null;
    fallback?: string[];
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
    providers: Record<string, ProviderHealthItem>;
}

interface EngineSelectorProps {
    currentEngine: string;
    onSelect: (engine: string) => void;
    apiKey: string;
    onApiKeyChange: (key: string) => void;
}

function getWebGpuDisableReason(capability: DeviceCapability): string | null {
    if (!capability.hasWebGpu) {
        return "WebGPU no disponible en este dispositivo";
    }
    if (capability.isLikelyLowEnd) {
        return "WebGPU desactivado por capacidad limitada del dispositivo";
    }
    return null;
}

export function EngineSelector({ currentEngine, onSelect, apiKey, onApiKeyChange }: EngineSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [engines, setEngines] = useState<Engine[]>([]);
    const [runtimePolicy, setRuntimePolicy] = useState<RuntimePolicy | null>(null);
    const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealthItem>>({});
    const [diagnosticsBlocked, setDiagnosticsBlocked] = useState(false);
    const [deviceCapability] = useState(() => detectDeviceCapability());

    useEffect(() => {
        const fetchEngines = async () => {
            try {
                const enginesResPromise = authFetch("/config/engines");
                const policyResPromise = diagnosticsBlocked
                    ? Promise.resolve<Response | null>(null)
                    : authFetch("/config/runtime-policy");
                const providerHealthResPromise = diagnosticsBlocked
                    ? Promise.resolve<Response | null>(null)
                    : authFetch("/health/providers");
                const [enginesRes, policyRes, providerHealthRes] = await Promise.all([
                    enginesResPromise,
                    policyResPromise,
                    providerHealthResPromise,
                ]);

                if (enginesRes.ok) {
                    const data = (await enginesRes.json()) as Engine[];
                    setEngines(data);
                } else {
                    setEngines(FALLBACK_ENGINES);
                }

                if (policyRes?.ok) {
                    const data = (await policyRes.json()) as RuntimePolicy;
                    setRuntimePolicy(data);
                } else {
                    setRuntimePolicy(null);
                }

                if (providerHealthRes?.ok) {
                    const healthData = (await providerHealthRes.json()) as ProvidersHealthResponse;
                    setProviderHealth(healthData.providers ?? {});
                } else {
                    setProviderHealth({});
                }

                if (
                    !diagnosticsBlocked &&
                    ((policyRes && [401, 403].includes(policyRes.status)) ||
                        (providerHealthRes && [401, 403].includes(providerHealthRes.status)))
                ) {
                    setDiagnosticsBlocked(true);
                }
            } catch (e) {
                console.error("Failed to fetch engines", e);
                setEngines(FALLBACK_ENGINES);
                setProviderHealth({});
            }
        };

        fetchEngines();
        const interval = window.setInterval(fetchEngines, 45000);
        return () => window.clearInterval(interval);
    }, [diagnosticsBlocked]);

    const normalizedEngines = (engines.length > 0 ? engines : FALLBACK_ENGINES).map((engine) => {
        const webGpuDisableReason = engine.id === "webgpu" ? getWebGpuDisableReason(deviceCapability) : null;
        if (webGpuDisableReason) {
            return {
                ...engine,
                enabled: false,
                reason_disabled: webGpuDisableReason,
            };
        }
        const health = providerHealth[engine.id];
        if (engine.id !== "webgpu" && health && health.available === false) {
            return {
                ...engine,
                enabled: false,
                reason_disabled: engine.reason_disabled || health.reason || "Proveedor temporalmente no disponible",
            };
        }
        const runtimeReliability = runtimePolicy?.provider_reliability?.[engine.id];
        if (engine.id !== "webgpu" && runtimeReliability && runtimeReliability.available === false) {
            return {
                ...engine,
                enabled: false,
                reason_disabled:
                    engine.reason_disabled ||
                    runtimeReliability.reason ||
                    "Proveedor temporalmente deshabilitado por degradación operativa",
            };
        }
        return engine;
    });

    const selectableEngines = normalizedEngines.filter((engine) => engine.enabled !== false);
    const activeEngine =
        normalizedEngines.find((e) => e.id === currentEngine) ||
        selectableEngines.find((e) => e.is_default) ||
        selectableEngines[0] ||
        normalizedEngines[0] ||
        FALLBACK_ENGINES[0];
    const recommendedEngine = selectableEngines.find(
        (engine) => engine.id === runtimePolicy?.recommended_engine && engine.id !== currentEngine
    );
    const activeEngineHealth = providerHealth[activeEngine.id];
    const hasCloudConnectivityIssues = Object.entries(providerHealth).some(
        ([id, health]) => id !== "webgpu" && health.available === false
    );
    const hasRuntimeUnavailableProviders = Object.entries(runtimePolicy?.provider_reliability || {}).some(
        ([id, info]) => id !== "webgpu" && info.available === false
    );
    const edumindHealth = providerHealth.edumind;
    const edumindRuntimeReliability = runtimePolicy?.provider_reliability?.edumind;

    useEffect(() => {
        if (normalizedEngines.length === 0) return;
        const selected = normalizedEngines.find((e) => e.id === currentEngine);
        if (!selected || selected.enabled === false) {
            const fallback = selectableEngines.find((e) => e.is_default) || selectableEngines[0];
            if (fallback) onSelect(fallback.id);
        }
    }, [currentEngine, normalizedEngines, onSelect, selectableEngines]);

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-hair hover:bg-paper-2 transition-colors text-sm font-medium"
            >
                <div className={`w-2 h-2 ${activeEngine.color}`} />
                {activeEngine.name}
                {activeEngine.id !== "webgpu" && activeEngineHealth && activeEngineHealth.available === false ? (
                    <span className="lam-mono text-alert">KO</span>
                ) : null}
                <span className="lam-mono lam-mono-ink ml-1">{isOpen ? "Cerrar" : "Cambiar"}</span>
            </button>
            {hasCloudConnectivityIssues || hasRuntimeUnavailableProviders ? (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-alert">
                    <span className="lam-mono text-alert">Aviso</span>
                    Conectividad cloud degradada. Revisa la recomendación antes de cambiar de motor.
                </div>
            ) : null}
            {recommendedEngine ? (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-vigencia">
                    <span className="lam-mono text-vigencia">Aviso</span>
                    Recomendado ahora: {recommendedEngine.name}
                    <button
                        type="button"
                        onClick={() => {
                            rememberEngine(recommendedEngine.id);
                            onSelect(recommendedEngine.id);
                        }}
                        className="lam-btn lam-btn-sm lam-btn-ghost !px-2 !py-1 !text-[10px] !border-vigencia !text-vigencia hover:!bg-vigencia hover:!text-paper"
                    >
                        Aplicar
                    </button>
                </div>
            ) : null}

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 w-80 bg-card border border-hair p-2 ">
                    {activeEngine.id !== "webgpu" && activeEngineHealth && activeEngineHealth.available === false ? (
                        <div className="mb-2 border-l-2 border-alert bg-paper-2 px-2 py-1.5 text-[11px] text-alert">
                            {activeEngine.name} no disponible: {activeEngineHealth.reason || "sin conectividad"}.
                        </div>
                    ) : null}
                    {activeEngine.id !== "webgpu" && activeEngineHealth ? (
                        <div className="mb-2 border-l-2 border-ink bg-paper-2 px-2 py-1.5 text-[11px] text-ink-2 font-mono">
                            Test de conexión (sin API key): DNS {activeEngineHealth.dns_ok ? "OK" : "KO"}, TLS{" "}
                            {activeEngineHealth.tls_ok ? "OK" : "KO"}, HTTP{" "}
                            {activeEngineHealth.http_ok ? "OK" : "KO"}
                            {typeof activeEngineHealth.http_status === "number"
                                ? ` (${activeEngineHealth.http_status})`
                                : ""}
                            .
                        </div>
                    ) : null}
                    {edumindHealth && edumindHealth.available === false ? (
                        <div className="mb-2 border-l-2 border-vigencia bg-paper-2 px-2 py-1.5 text-[11px] text-vigencia">
                            EDUmind Cloud Lite caído temporalmente. Se recomienda WebGPU o BYOK.
                        </div>
                    ) : null}
                    {edumindRuntimeReliability && edumindRuntimeReliability.available === false ? (
                        <div className="mb-2 border-l-2 border-alert bg-paper-2 px-2 py-1.5 text-[11px] text-alert">
                            EDUmind Cloud Lite deshabilitado por degradación operativa:{" "}
                            {edumindRuntimeReliability.reason || "fallback a WebGPU/BYOK"}.
                        </div>
                    ) : null}
                    {!deviceCapability.hasWebGpu ? (
                        <div className="mb-2 border-l-2 border-vigencia bg-paper-2 px-2 py-1.5 text-[11px] text-vigencia">
                            Este dispositivo no soporta WebGPU. Usa motor cloud o BYOK.
                        </div>
                    ) : null}
                    {deviceCapability.hasWebGpu && deviceCapability.isLikelyLowEnd ? (
                        <div className="mb-2 border-l-2 border-vigencia bg-paper-2 px-2 py-1.5 text-[11px] text-vigencia">
                            WebGPU desactivado para priorizar estabilidad en este dispositivo. Usa cloud/BYOK.
                        </div>
                    ) : null}
                    {runtimePolicy && !runtimePolicy.managed_public_enabled ? (
                        <div className="mb-2 border-l-2 border-alert bg-paper-2 px-2 py-1.5 text-[11px] text-alert">
                            Modo sostenibilidad activo. El motor cloud gestionado puede estar temporalmente limitado.
                        </div>
                    ) : null}
                    <div className="space-y-1 mb-3">
                        {normalizedEngines.map((engine) => (
                            <button
                                key={engine.id}
                                disabled={engine.enabled === false}
                                onClick={() => {
                                    if (engine.enabled === false) return;
                                    rememberEngine(engine.id);
                                    onSelect(engine.id);
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 transition-colors text-left border border-transparent",
                                    currentEngine === engine.id ? "bg-ink text-paper" : "hover:bg-paper-2",
                                    engine.enabled === false && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                )}
                            >
                                <div className={`w-2.5 h-2.5 shrink-0 ${engine.color}`} />
                                <div>
                                    <div className="font-medium text-sm">{engine.name}</div>
                                    <div className={cn("text-xs", currentEngine === engine.id ? "text-paper/80" : "text-ink-2")}>{engine.desc}</div>
                                    {engine.reason_disabled ? (
                                        <div className="text-[10px] text-alert mt-0.5">{engine.reason_disabled}</div>
                                    ) : null}
                                </div>
                                {engine.enabled === false ? (
                                    <span className="ml-auto lam-mono">Bloqueado</span>
                                ) : null}
                                {currentEngine === engine.id && (
                                    <span className="ml-auto lam-mono !text-paper">Activo</span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="px-1 pt-2 border-t border-hair">
                        <div className="flex items-center gap-2 mb-1.5 px-2">
                            <span className="lam-mono">API Key para {activeEngine.name}</span>
                        </div>
                        {activeEngine.requires_api_key ? (
                            <>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => onApiKeyChange(e.target.value)}
                                    onInput={(e) => onApiKeyChange((e.target as HTMLInputElement).value)}
                                    placeholder={`sk-... (${activeEngine.name})`}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="lam-input !py-2 text-xs font-mono"
                                />
                                {!apiKey ? (
                                    <div className="mt-1.5 text-[11px] text-vigencia">
                                        Este motor requiere BYOK para generar.
                                    </div>
                                ) : null}
                                {activeEngineHealth?.auth_required ? (
                                    <div className="mt-1.5 text-[10px] text-ink-2">
                                        El test de conexión no valida tu API key; solo verifica conectividad de red.
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <div className="border-l-2 border-ok bg-paper-2 px-2 py-1.5 text-[11px] text-ok">
                                Este motor no requiere API key en cliente.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
