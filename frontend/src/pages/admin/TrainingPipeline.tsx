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
import { NoticeBanner } from "@/components/NoticeBanner";
import {
    Cpu,
    Play,
    CheckCircle,
    Clock,
    AlertCircle,
    RefreshCw,
    FileText,
    Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TrainingJob {
    id: number;
    version: string;
    status: string;
    dataset_path: string | null;
    model_path: string | null;
    example_count: number;
    epochs: number;
    learning_rate: number;
    base_model: string;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
}

interface ModelVersion {
    version: string;
    version_name: string;
    dataset_path: string;
    model_path: string;
    example_count: number;
    base_model: string;
    epochs: number;
    learning_rate: number;
    created_at: string;
}

interface TrainingQueueStats {
    queued: number;
    running: number;
    failed: number;
}

export default function TrainingPipeline() {
    const [jobs, setJobs] = useState<TrainingJob[]>([]);
    const [models, setModels] = useState<ModelVersion[]>([]);
    const [queueStats, setQueueStats] = useState<TrainingQueueStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [preparing, setPreparing] = useState(false);
    const [majorVersion, setMajorVersion] = useState(false);
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [jobsRes, modelsRes, queueRes] = await Promise.all([
                authFetch("/training/jobs"),
                authFetch("/training/models"),
                authFetch("/training/queue/stats"),
            ]);
            setJobs(await jobsRes.json());
            setModels(await modelsRes.json());
            if (queueRes.ok) {
                setQueueStats((await queueRes.json()) as TrainingQueueStats);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePrepare = async () => {
        setPreparing(true);
        try {
            const response = await authFetch("/training/prepare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    verified_only: true,
                    major_version: majorVersion,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                setNotice({
                    variant: "success",
                    message: `Dataset preparado: ${data.example_count} items. Job ID: ${data.job_id}.`,
                });
                fetchData();
            } else {
                setNotice({ variant: "error", message: data.detail || "Error preparando dataset." });
            }
        } catch {
            setNotice({ variant: "error", message: "Error preparando dataset." });
        } finally {
            setPreparing(false);
        }
    };

    const handleStartTraining = async (jobId: number) => {
        try {
            const response = await authFetch(`/api/v1/training/start/${jobId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    job_id: jobId,
                    epochs: 3,
                    learning_rate: 0.0002,
                    base_model: "mistralai/Mistral-7B-v0.1",
                }),
            });
            const data = await response.json();
            if (response.ok) {
                setNotice({ variant: "success", message: data.message });
                fetchData();
            } else {
                setNotice({ variant: "error", message: data.detail || "Error iniciando entrenamiento." });
            }
        } catch {
            setNotice({ variant: "error", message: "Error iniciando entrenamiento." });
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; icon: LucideIcon }> = {
            preparing: { bg: "bg-yellow-600/20", text: "text-yellow-400", icon: Clock },
            ready: { bg: "bg-blue-600/20", text: "text-blue-400", icon: Zap },
            queued: { bg: "bg-indigo-600/20", text: "text-indigo-300", icon: Clock },
            training: { bg: "bg-purple-600/20", text: "text-purple-400", icon: Cpu },
            completed: { bg: "bg-green-600/20", text: "text-green-400", icon: CheckCircle },
            failed: { bg: "bg-red-600/20", text: "text-red-400", icon: AlertCircle },
        };
        const style = styles[status] || styles.preparing;
        const Icon = style.icon;

        return (
            <span className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${style.bg} ${style.text}`}>
                <Icon className="w-4 h-4" />
                {status}
            </span>
        );
    };

    return (
        <AdminLayout>
            <div className="space-y-8">
                {notice ? (
                    <NoticeBanner
                        variant={notice.variant}
                        message={notice.message}
                        onClose={() => setNotice(null)}
                    />
                ) : null}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Training Pipeline
                        </h1>
                        <p className="text-slate-400">
                            Entrenar y versionar modelos EDUmind
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Prepare Section */}
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        Preparar Nuevo Entrenamiento
                    </h2>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-slate-400">
                            <input
                                type="checkbox"
                                checked={majorVersion}
                                onChange={(e) => setMajorVersion(e.target.checked)}
                                className="rounded"
                            />
                            Versión Mayor (1.x → 2.0)
                        </label>
                        <button
                            onClick={handlePrepare}
                            disabled={preparing}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            <FileText className="w-5 h-5" />
                            {preparing ? "Preparando..." : "Preparar Dataset"}
                        </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                        Exporta items verificados a JSONL y crea un job listo para entrenar.
                    </p>
                </div>

                {/* Jobs Table */}
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-lg font-semibold text-white">
                                Jobs de Entrenamiento
                            </h2>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span>Cola: {queueStats?.queued ?? 0}</span>
                                <span>Running: {queueStats?.running ?? 0}</span>
                                <span>Failed: {queueStats?.failed ?? 0}</span>
                            </div>
                        </div>
                    </div>
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="p-4 text-left text-sm text-slate-400">Versión</th>
                                <th className="p-4 text-left text-sm text-slate-400">Estado</th>
                                <th className="p-4 text-left text-sm text-slate-400">Items</th>
                                <th className="p-4 text-left text-sm text-slate-400">Epochs</th>
                                <th className="p-4 text-left text-sm text-slate-400">Creado</th>
                                <th className="p-4 text-left text-sm text-slate-400">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No hay jobs. Prepara un dataset primero.
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.id} className="border-t border-white/5 hover:bg-white/5">
                                        <td className="p-4">
                                            <span className="text-white font-mono">
                                                {job.version}
                                            </span>
                                        </td>
                                        <td className="p-4">{getStatusBadge(job.status)}</td>
                                        <td className="p-4 text-slate-300">{job.example_count}</td>
                                        <td className="p-4 text-slate-300">{job.epochs}</td>
                                        <td className="p-4 text-slate-500 text-sm">
                                            {new Date(job.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            {job.status === "ready" && (
                                                <button
                                                    onClick={() => handleStartTraining(job.id)}
                                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                                                >
                                                    <Play className="w-4 h-4" />
                                                    Entrenar
                                                </button>
                                            )}
                                            {job.status === "training" && (
                                                <span className="text-purple-400 text-sm animate-pulse">
                                                    Entrenando...
                                                </span>
                                            )}
                                            {job.status === "queued" && (
                                                <span className="text-indigo-300 text-sm">
                                                    En cola (worker pendiente)
                                                </span>
                                            )}
                                            {job.status === "completed" && (
                                                <span className="text-green-400 text-sm">
                                                    ✅ Completado
                                                </span>
                                            )}
                                            {job.status === "failed" && (
                                                <span className="text-red-400 text-sm truncate max-w-[200px]" title={job.error_message || ""}>
                                                    ❌ {job.error_message?.substring(0, 30)}...
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Trained Models */}
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-semibold text-white">
                            Modelos Entrenados
                        </h2>
                    </div>
                    {models.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            No hay modelos entrenados aún.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                            {models.map((model) => (
                                <div
                                    key={model.version}
                                    className="bg-white/5 border border-white/10 rounded-lg p-4"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-green-600/20 rounded-lg">
                                            <CheckCircle className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-mono font-bold">
                                                {model.version_name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(model.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-slate-400">
                                            <span className="text-slate-500">Items:</span> {model.example_count}
                                        </p>
                                        <p className="text-slate-400">
                                            <span className="text-slate-500">Epochs:</span> {model.epochs}
                                        </p>
                                        <p className="text-slate-400 truncate">
                                            <span className="text-slate-500">Base:</span> {model.base_model}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
