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
                        <h1 className="text-[26px] font-bold tracking-[-0.02em]">
                            Dataset Builder
                        </h1>
                        <p className="text-ink-2">
                            Curar y gestionar datos de entrenamiento
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={fetchItems}
                            className="lam-btn lam-btn-sm lam-btn-ghost"
                        >
                            Actualizar
                        </button>
                        <button
                            onClick={handleExport}
                            className="lam-btn lam-btn-sm"
                        >
                            Exportar JSONL
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="border-t border-hair pt-3">
                            <p className="lam-mono">Total items</p>
                            <p className="font-extrabold text-[32px] tracking-[-0.03em]">
                                {stats.total_items}
                            </p>
                        </div>
                        <div className="border-t border-hair pt-3">
                            <p className="lam-mono">Verificados</p>
                            <p className="font-extrabold text-[32px] tracking-[-0.03em] text-ok">
                                {stats.verified_items}
                            </p>
                        </div>
                        <div className="border-t border-hair pt-3">
                            <p className="lam-mono">Pendientes</p>
                            <p className="font-extrabold text-[32px] tracking-[-0.03em]">
                                {stats.pending_items}
                            </p>
                        </div>
                        <div className="border-t border-hair pt-3">
                            <p className="lam-mono">Documentos</p>
                            <p className="font-extrabold text-[32px] tracking-[-0.03em]">
                                {stats.total_documents}
                            </p>
                        </div>
                    </div>
                )}

                {/* Upload Area */}
                <div className="bg-card border border-dashed border-ink p-8">
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
                        <p className="lam-mono lam-mono-ink">
                            {uploading ? "Subiendo..." : "Subir archivo"}
                        </p>
                        <p className="text-sm text-ink-3 mt-1">
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
                                className={`font-mono text-[11px] uppercase tracking-[0.12em] px-4 py-2 border border-ink transition-colors ${filter === f ? "bg-ink text-paper" : "text-ink hover:bg-paper-2"}`}
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
                            className="lam-btn lam-btn-sm"
                        >
                            Verificar ({selectedIds.length})
                        </button>
                    )}
                </div>

                {/* Items Table */}
                <div className="lam-panel !p-0 overflow-hidden">
                    <table className="lam-table">
                        <thead>
                            <tr>
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === items.length && items.length > 0}
                                        onChange={selectAll}
                                        className=""
                                    />
                                </th>
                                <th className="p-4">
                                    Instrucción
                                </th>
                                <th className="p-4">
                                    Respuesta
                                </th>
                                <th className="p-4">
                                    Fuente
                                </th>
                                <th className="p-4">
                                    Estado
                                </th>
                                <th className="p-4">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ink-2">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-ink-2">
                                        No hay items. Sube archivos para empezar.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-t border-hair hover:bg-card"
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className=""
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
                                                    className="lam-textarea text-sm"
                                                    rows={3}
                                                />
                                            ) : (
                                                <p className="text-ink text-sm line-clamp-2">
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
                                                    className="lam-textarea text-sm"
                                                    rows={3}
                                                />
                                            ) : (
                                                <p className="text-ink-2 text-sm line-clamp-2">
                                                    {item.output}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="lam-mono">
                                                {item.source}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {item.is_verified ? (
                                                <span className="lam-stamp">Verificado</span>
                                            ) : (
                                                <span className="lam-stamp !border-vigencia !text-vigencia">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                {editingId === item.id ? (
                                                    <>
                                                        <button
                                                            onClick={handleSaveEdit}
                                                            className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] border border-ink hover:bg-ink hover:text-paper"
                                                        >
                                                            Guardar
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] border border-ink hover:bg-ink hover:text-paper"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {!item.is_verified && (
                                                            <button
                                                                onClick={() => handleVerify(item.id)}
                                                                className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] border border-ink hover:bg-ink hover:text-paper"
                                                                title="Verificar"
                                                            >
                                                                Verificar
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] border border-ink hover:bg-ink hover:text-paper"
                                                            title="Editar"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => setPendingDeleteId(item.id)}
                                                            className="px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] border border-alert text-alert hover:bg-alert hover:text-paper"
                                                            title="Eliminar"
                                                        >
                                                            Eliminar
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
