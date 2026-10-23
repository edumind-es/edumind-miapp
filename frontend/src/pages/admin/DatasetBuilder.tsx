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

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { NoticeBanner } from "@/components/NoticeBanner";
import {
    Upload,
    Check,
    X,
    Edit,
    Trash2,
    Download,
    RefreshCw,
    CheckCircle,
    AlertCircle
} from "lucide-react";

interface TrainingItem {
    id: number;
    instruction: string;
    output: string;
    source: string;
    quality_score: number;
    is_verified: boolean;
    created_at: string;
}

interface DatasetStats {
    total_items: number;
    verified_items: number;
    pending_items: number;
    total_documents: number;
}

export default function DatasetBuilder() {
    const [items, setItems] = useState<TrainingItem[]>([]);
    const [stats, setStats] = useState<DatasetStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [filter, setFilter] = useState<"all" | "verified" | "pending">("all");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ instruction: "", output: "" });
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter === "verified") params.append("verified_only", "true");
            if (filter === "pending") params.append("pending_only", "true");

            const response = await authFetch(`/api/v1/dataset/items?${params}`);
            const data = await response.json();
            setItems(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    const fetchStats = async () => {
        try {
            const response = await authFetch("/dataset/stats");
            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchStats();
    }, [fetchItems]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await authFetch("/dataset/upload", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (data.processing_status === "queued") {
                setNotice({
                    variant: "info",
                    message: "Archivo subido. El procesamiento se ha enviado a la cola en segundo plano.",
                });
            } else {
                setNotice({
                    variant: "success",
                    message: `Archivo subido. ${data.items_created} items creados.`,
                });
            }
            fetchItems();
            fetchStats();
        } catch {
            setNotice({ variant: "error", message: "Error subiendo archivo." });
        } finally {
            setUploading(false);
        }
    };

    const handleVerify = async (id: number) => {
        try {
            await authFetch(`/api/v1/dataset/items/${id}/verify`, {
                method: "POST",
            });
            fetchItems();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const handleBulkVerify = async () => {
        if (selectedIds.length === 0) return;
        try {
            await authFetch("/dataset/items/bulk-verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(selectedIds),
            });
            setSelectedIds([]);
            fetchItems();
            fetchStats();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await authFetch(`/api/v1/dataset/items/${id}`, {
                method: "DELETE",
            });
            setPendingDeleteId(null);
            setNotice({ variant: "success", message: "Item eliminado correctamente." });
            fetchItems();
            fetchStats();
        } catch (err) {
            console.error(err);
            setNotice({ variant: "error", message: "No se pudo eliminar el item." });
        }
    };

    const handleEdit = (item: TrainingItem) => {
        setEditingId(item.id);
        setEditForm({ instruction: item.instruction, output: item.output });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        try {
            await authFetch(`/api/v1/dataset/items/${editingId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(editForm),
            });
            setEditingId(null);
            fetchItems();
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async () => {
        try {
            const response = await authFetch("/dataset/export", {
                method: "POST",
            });
            const data = await response.json();
            setNotice({ variant: "success", message: data.message });
        } catch {
            setNotice({ variant: "error", message: "Error exportando dataset." });
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(items.map((i) => i.id));
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
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
                            Dataset Builder
                        </h1>
                        <p className="text-slate-400">
                            Curar y gestionar datos de entrenamiento
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={fetchItems}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-5 h-5 text-slate-400" />
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Exportar JSONL
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-4">
                            <p className="text-sm text-slate-400">Total Items</p>
                            <p className="text-2xl font-bold text-white">
                                {stats.total_items}
                            </p>
                        </div>
                        <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-4">
                            <p className="text-sm text-slate-400">Verificados</p>
                            <p className="text-2xl font-bold text-green-400">
                                {stats.verified_items}
                            </p>
                        </div>
                        <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-4">
                            <p className="text-sm text-slate-400">Pendientes</p>
                            <p className="text-2xl font-bold text-yellow-400">
                                {stats.pending_items}
                            </p>
                        </div>
                        <div className="bg-[#1a1f2e] border border-white/10 rounded-lg p-4">
                            <p className="text-sm text-slate-400">Documentos</p>
                            <p className="text-2xl font-bold text-blue-400">
                                {stats.total_documents}
                            </p>
                        </div>
                    </div>
                )}

                {/* Upload Area */}
                <div className="bg-[#1a1f2e] border border-dashed border-white/20 rounded-xl p-8">
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.docx,.xlsx,.pptx,.md,.json,.jsonl,.txt,.png,.jpg"
                    />
                    <label
                        htmlFor="file-upload"
                        className="flex flex-col items-center cursor-pointer"
                    >
                        <Upload className="w-12 h-12 text-slate-500 mb-4" />
                        <p className="text-white font-medium">
                            {uploading ? "Subiendo..." : "Subir archivo"}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                            PDF, DOCX, XLSX, PPTX, MD, JSON, PNG
                        </p>
                    </label>
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {(["all", "verified", "pending"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg transition-colors ${filter === f
                                    ? "bg-blue-600 text-white"
                                    : "bg-white/10 text-slate-400 hover:bg-white/20"
                                    }`}
                            >
                                {f === "all"
                                    ? "Todos"
                                    : f === "verified"
                                        ? "Verificados"
                                        : "Pendientes"}
                            </button>
                        ))}
                    </div>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkVerify}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Verificar ({selectedIds.length})
                        </button>
                    )}
                </div>

                {/* Items Table */}
                <div className="bg-[#1a1f2e] border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === items.length && items.length > 0}
                                        onChange={selectAll}
                                        className="rounded"
                                    />
                                </th>
                                <th className="p-4 text-left text-sm text-slate-400">
                                    Instrucción
                                </th>
                                <th className="p-4 text-left text-sm text-slate-400">
                                    Respuesta
                                </th>
                                <th className="p-4 text-left text-sm text-slate-400">
                                    Fuente
                                </th>
                                <th className="p-4 text-left text-sm text-slate-400">
                                    Estado
                                </th>
                                <th className="p-4 text-left text-sm text-slate-400">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        No hay items. Sube archivos para empezar.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t border-white/5 hover:bg-white/5"
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="rounded"
                                            />
                                        </td>
                                        <td className="p-4">
                                            {editingId === item.id ? (
                                                <textarea
                                                    value={editForm.instruction}
                                                    onChange={(e) =>
                                                        setEditForm({
                                                            ...editForm,
                                                            instruction: e.target.value,
                                                        })
                                                    }
                                                    className="w-full bg-white/10 border border-white/20 rounded p-2 text-white text-sm"
                                                    rows={3}
                                                />
                                            ) : (
                                                <p className="text-white text-sm line-clamp-2">
                                                    {item.instruction}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingId === item.id ? (
                                                <textarea
                                                    value={editForm.output}
                                                    onChange={(e) =>
                                                        setEditForm({
                                                            ...editForm,
                                                            output: e.target.value,
                                                        })
                                                    }
                                                    className="w-full bg-white/10 border border-white/20 rounded p-2 text-white text-sm"
                                                    rows={3}
                                                />
                                            ) : (
                                                <p className="text-slate-300 text-sm line-clamp-2">
                                                    {item.output}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs text-slate-500 bg-white/10 px-2 py-1 rounded">
                                                {item.source}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {item.is_verified ? (
                                                <span className="flex items-center gap-1 text-green-400 text-sm">
                                                    <CheckCircle className="w-4 h-4" />
                                                    Verificado
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-400 text-sm">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                {editingId === item.id ? (
                                                    <>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="p-2 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="p-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {!item.is_verified && (
                                                            <button
                                                                onClick={() => handleVerify(item.id)}
                                                                className="p-2 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
                                                                title="Verificar"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="p-2 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30"
                                                            title="Editar"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setPendingDeleteId(item.id)}
                                                            className="p-2 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ConfirmationDialog
                open={pendingDeleteId !== null}
                title="Eliminar item del dataset"
                description="Se borrará este item del dataset curado. Usa esta acción solo cuando el contenido no deba seguir disponible para revisión o entrenamiento."
                confirmLabel="Eliminar item"
                destructive
                onConfirm={() => pendingDeleteId !== null && void handleDelete(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />
        </AdminLayout>
    );
}
