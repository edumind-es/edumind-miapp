/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

import { useCallback, useEffect, useState } from "react";

import { AdminLayout } from "../../layouts/AdminLayout";
import { authFetch } from "@/lib/auth-client";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { NoticeBanner } from "@/components/NoticeBanner";

type UserRole = "admin" | "teacher_premium" | "docente" | "opositor" | "centro";

interface UserOut {
    id: number;
    username: string;
    email?: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
}

const ROLE_OPTIONS: UserRole[] = ["admin", "teacher_premium", "docente", "opositor", "centro"];
const getErrorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error ? err.message : fallback;

export default function AdminUsers() {
    const [users, setUsers] = useState<UserOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState<{ variant: "success" | "error" | "info"; message: string } | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        role: "docente" as UserRole,
    });

    const loadUsers = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError("");

            const response = await authFetch("/admin/users?limit=200");
            if (!response.ok) throw new Error("No se pudieron cargar usuarios");
            const payload = (await response.json()) as UserOut[];
            setUsers(payload);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error cargando usuarios"));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const createUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.username.trim() || !form.password.trim()) return;

        try {
            setSaving(true);
            setError("");
            const response = await authFetch("/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: form.username.trim(),
                    email: form.email.trim() || null,
                    password: form.password,
                    role: form.role,
                }),
            });

            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || "No se pudo crear usuario");
            }

            setForm({ username: "", email: "", password: "", role: "docente" });
            setNotice({ variant: "success", message: "Usuario creado correctamente." });
            await loadUsers(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error creando usuario"));
        } finally {
            setSaving(false);
        }
    };

    const updateUser = async (userId: number, patch: Partial<UserOut> & { password?: string }) => {
        try {
            const response = await authFetch(`/api/v1/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || "No se pudo actualizar usuario");
            }
            setNotice({ variant: "success", message: "Usuario actualizado correctamente." });
            await loadUsers(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error actualizando usuario"));
        }
    };

    const deleteUser = async (userId: number) => {
        try {
            const response = await authFetch(`/api/v1/admin/users/${userId}`, { method: "DELETE" });
            if (!response.ok) {
                const msg = await response.text();
                throw new Error(msg || "No se pudo eliminar usuario");
            }
            setPendingDeleteId(null);
            setNotice({ variant: "success", message: "Usuario eliminado correctamente." });
            await loadUsers(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Error eliminando usuario"));
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-[26px] font-bold tracking-[-0.02em]">Gestión de Usuarios</h1>
                        <p className="text-ink-2">CRUD operativo de usuarios y roles</p>
                    </div>
                    <button
                        onClick={() => void loadUsers(true)}
                        disabled={loading || refreshing}
                        className="lam-btn lam-btn-sm"
                    >
                        Actualizar
                    </button>
                </div>

                {error ? (
                    <div className="lam-note alert flex items-center gap-3">
                        <span className="text-alert text-sm">{error}</span>
                    </div>
                ) : null}

                <form onSubmit={createUser} className="lam-panel space-y-3">
                    <h2 className="text-[17px] font-bold">
                        Crear usuario
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                            value={form.username}
                            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                            placeholder="username"
                            className="lam-input text-sm"
                            required
                        />
                        <input
                            value={form.email}
                            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="email (opcional)"
                            className="lam-input text-sm"
                        />
                        <input
                            value={form.password}
                            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                            type="password"
                            placeholder="password"
                            className="lam-input text-sm"
                            required
                        />
                        <select
                            value={form.role}
                            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                            className="lam-input text-sm"
                        >
                            {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="lam-btn lam-btn-sm"
                    >
                        {saving ? "Creando..." : "Crear"}
                    </button>
                </form>

                <div className="border-t border-hair pt-3">
                    {loading ? (
                        <div className="h-40 flex items-center justify-center">
                            <span className="lam-mono">Cargando</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="lam-table">
                                <thead>
                                    <tr>
                                        <th className="pr-3">ID</th>
                                        <th className="pr-3">Usuario</th>
                                        <th className="pr-3">Email</th>
                                        <th className="pr-3">Rol</th>
                                        <th className="pr-3">Activo</th>
                                        <th className="pr-3">Alta</th>
                                        <th className="text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-hair">
                                            <td className="py-2 pr-3 text-ink-2">{user.id}</td>
                                            <td className="py-2 pr-3 text-ink">{user.username}</td>
                                            <td className="py-2 pr-3 text-ink-2">{user.email || "-"}</td>
                                            <td className="py-2 pr-3">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) =>
                                                        void updateUser(user.id, { role: e.target.value as UserRole })
                                                    }
                                                    className="lam-input !px-2 !py-1 text-xs"
                                                >
                                                    {ROLE_OPTIONS.map((role) => (
                                                        <option key={role} value={role}>
                                                            {role}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 pr-3">
                                                <button
                                                    onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                                                    className={user.is_active ? "lam-stamp" : "lam-stamp !border-hair !text-ink-3"}
                                                >
                                                    {user.is_active ? "Sí" : "No"}
                                                </button>
                                            </td>
                                            <td className="py-2 pr-3 text-ink-2">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-2 text-right">
                                                <button
                                                    onClick={() => setPendingDeleteId(user.id)}
                                                    className="font-mono text-[11px] uppercase tracking-[0.12em] text-alert hover:underline underline-offset-4"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            <ConfirmationDialog
                open={pendingDeleteId !== null}
                title="Eliminar usuario"
                description="Se eliminará el usuario seleccionado y perderá acceso a la aplicación. Confirma solo si no debe seguir existiendo."
                confirmLabel="Eliminar usuario"
                destructive
                onConfirm={() => pendingDeleteId !== null && void deleteUser(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />
        </AdminLayout>
    );
}
