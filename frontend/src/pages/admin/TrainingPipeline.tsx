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

    // Estado del job como sello mono: ok (completado), alerta (fallido), vigencia (en espera) o tinta
    const getStatusBadge = (status: string) => {
        const tone: Record<string, string> = {
            completed: "lam-stamp",
            failed: "lam-stamp !border-alert !text-alert",
            training: "lam-stamp !border-ink !text-ink",
            ready: "lam-stamp !border-ink !text-ink",
            queued: "lam-stamp !border-vigencia !text-vigencia",
            preparing: "lam-stamp !border-vigencia !text-vigencia",
        };
        return <span className={tone[status] || tone.preparing}>{status}</span>;
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
                        <h1 className="text-[26px] font-bold tracking-[-0.02em]">
                            Training Pipeline
                        </h1>
                        <p className="text-ink-2">
                            Entrenar y versionar modelos EDUmind
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="lam-btn lam-btn-sm lam-btn-ghost"
                    >
                        Actualizar
                    </button>
                </div>

                {/* Prepare Section */}
                <div className="lam-panel !p-6">
                    <h2 className="text-[17px] font-bold mb-4">
                        Preparar Nuevo Entrenamiento
                    </h2>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-ink-2 text-sm">
                            <input
                                type="checkbox"
                                checked={majorVersion}
                                onChange={(e) => setMajorVersion(e.target.checked)}
                                className=""
                            />
                            Versión Mayor (1.x → 2.0)
                        </label>
                        <button
                            onClick={handlePrepare}
                            disabled={preparing}
                            className="lam-btn"
                        >
                            {preparing ? "Preparando..." : "Preparar Dataset"}
                        </button>
                    </div>
                    <p className="text-sm text-ink-3 mt-3">
                        Exporta items verificados a JSONL y crea un job listo para entrenar.
                    </p>
                </div>

                {/* Jobs Table */}
                <div className="lam-panel !p-0 overflow-hidden">
                    <div className="p-4 border-b border-hair">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-[17px] font-bold">
                                Jobs de Entrenamiento
                            </h2>
                            <div className="flex items-center gap-3 lam-mono">
                                <span>Cola: {queueStats?.queued ?? 0}</span>
                                <span>Running: {queueStats?.running ?? 0}</span>
                                <span>Failed: {queueStats?.failed ?? 0}</span>
                            </div>
                        </div>
                    </div>
                    <table className="lam-table">
                        <thead>
                            <tr>
                                <th className="p-4">Versión</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4">Items</th>
                                <th className="p-4">Epochs</th>
                                <th className="p-4">Creado</th>
                                <th className="p-4">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ink-2">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : jobs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ink-2">
                                        No hay jobs. Prepara un dataset primero.
                                    </td>
                                </tr>
                            ) : (
                                jobs.map((job) => (
                                    <tr key={job.id} className="border-t border-hair hover:bg-card">
                                        <td className="p-4">
                                            <span className="text-ink font-mono">
                                                {job.version}
                                            </span>
                                        </td>
                                        <td className="p-4">{getStatusBadge(job.status)}</td>
                                        <td className="p-4 text-ink-2">{job.example_count}</td>
                                        <td className="p-4 text-ink-2">{job.epochs}</td>
                                        <td className="p-4 text-ink-3 text-sm">
                                            {new Date(job.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            {job.status === "ready" && (
                                                <button
                                                    onClick={() => handleStartTraining(job.id)}
                                                    className="lam-btn lam-btn-sm"
                                                >
                                                    Entrenar
                                                </button>
                                            )}
                                            {job.status === "training" && (
                                                <span className="lam-mono lam-mono-ink">
                                                    Entrenando...
                                                </span>
                                            )}
                                            {job.status === "queued" && (
                                                <span className="lam-mono">
                                                    En cola (worker pendiente)
                                                </span>
                                            )}
                                            {job.status === "completed" && (
                                                <span className="lam-mono text-ok">
                                                    Completado
                                                </span>
                                            )}
                                            {job.status === "failed" && (
                                                <span className="text-alert text-sm truncate max-w-[200px]" title={job.error_message || ""}>
                                                    {job.error_message?.substring(0, 30)}...
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
                <div className="lam-panel !p-0 overflow-hidden">
                    <div className="p-4 border-b border-hair">
                        <h2 className="text-[17px] font-bold">
                            Modelos Entrenados
                        </h2>
                    </div>
                    {models.length === 0 ? (
                        <div className="p-8 text-center text-ink-2">
                            No hay modelos entrenados aún.
                        </div>
                    ) : (
                        <ul className="lam-rules mx-4 mb-2">
                            {models.map((model) => (
                                <li key={model.version} className="flex-wrap">
                                    <span className="dash">—</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="m-0 font-mono font-medium">{model.version_name}</p>
                                        <p className="m-0 mt-1 text-sm text-ink-2 truncate">
                                            {model.example_count} items · {model.epochs} epochs · {model.base_model}
                                        </p>
                                    </div>
                                    <span className="lam-mono self-center">{new Date(model.created_at).toLocaleDateString()}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
