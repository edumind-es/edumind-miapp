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

// Panel de herramientas en modo EDUmind-Lámina: lista de filete numerada, sin rejilla
// de tarjetas, sin iconos. El perfil se resuelve igual que antes (sesión o ?role=).

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { TeacherProfileForm } from "@/components/TeacherProfileForm";
import { useAuthSession } from "@/hooks/useAuthSession";
import { deleteCurrentAccount } from "@/lib/auth-client";
import { toolsForProfile, type ToolDefinition, type ToolProfile } from "@/lib/tools-registry";

// Las herramientas de cada perfil salen del registro único (lib/tools-registry.ts).
const TOOLS: Record<ToolProfile, ToolDefinition[]> = {
    docente: toolsForProfile("docente"),
    opositor: toolsForProfile("opositor"),
    centro: toolsForProfile("centro"),
};

const ROLE_TO_TOOLS_KEY: Record<string, keyof typeof TOOLS> = {
    docente: "docente",
    teacher_premium: "docente",
    admin: "docente",
    opositor: "opositor",
    centro: "centro",
};

const ROLE_LABELS: Record<string, string> = {
    docente: "Docente",
    teacher_premium: "Docente Premium",
    admin: "Administrador",
    opositor: "Opositor",
    centro: "Centro",
};

const PROFILE_SWITCH: Array<{ key: keyof typeof TOOLS; label: string }> = [
    { key: "docente", label: "Docentes" },
    { key: "opositor", label: "Opositores" },
    { key: "centro", label: "Centros" },
];

export default function Dashboard() {
    const { user, refreshSession } = useAuthSession();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // Supresión de cuenta: el docente escribe su usuario, confirma en el diálogo y el servidor borra todo.
    const [deleteConfirm, setDeleteConfirm] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const canRequestDelete = Boolean(user) && deleteConfirm.trim().toLowerCase() === (user?.username ?? "").toLowerCase();

    async function handleDeleteAccount() {
        if (!user) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteCurrentAccount(deleteConfirm.trim());
            setDeleteDialogOpen(false);
            await refreshSession();
            navigate("/", { replace: true });
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la cuenta.");
        } finally {
            setDeleting(false);
        }
    }
    const sessionRole = user?.role ?? "";
    const requestedRole = searchParams.get("role") ?? "";
    const toolsKey = ROLE_TO_TOOLS_KEY[requestedRole] ?? ROLE_TO_TOOLS_KEY[sessionRole] ?? "docente";
    const tools = TOOLS[toolsKey];
    const roleLabel = ROLE_LABELS[requestedRole] ?? ROLE_LABELS[sessionRole] ?? "EDUmind";

    return (
        <main className="lam-wrap pb-16">
            <div className="lam-cols pt-12">
                <div>
                    <p className="lam-eyebrow mb-4">EDUmind · Panel de herramientas</p>
                    <h1 className="lam-h1 mb-6">
                        Panel <span className="light">{roleLabel}</span>
                    </h1>
                    <p className="lam-lede mb-8">Selecciona una herramienta para empezar a generar contenido.</p>

                    <ul className="lam-rules">
                        {tools.map((tool, index) => (
                            <li key={`${toolsKey}-${tool.id}`} className="!py-5">
                                <span className="font-sans font-extrabold text-[28px] leading-none text-mental w-12 shrink-0 pt-1">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h2 className="m-0 text-[20px] font-bold">
                                        <Link to={tool.path} className="no-underline hover:underline underline-offset-4">
                                            {tool.title}
                                        </Link>
                                    </h2>
                                    <p className="m-0 mt-1 text-ink-2 max-w-[60ch]">{tool.desc}</p>
                                </div>
                                <Link to={tool.path} className="lam-btn lam-btn-sm lam-btn-ghost self-center shrink-0">
                                    Abrir
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <aside className="lam-aside">
                    <div className="lam-mono mb-3">Perfil</div>
                    <div className="lam-seg w-full">
                        {PROFILE_SWITCH.map((profile) => (
                            <Link
                                key={profile.key}
                                to={`/dashboard?role=${profile.key}`}
                                className={`flex-1 text-center font-mono text-[11px] uppercase tracking-[0.12em] py-3 border-r border-ink last:border-r-0 ${
                                    toolsKey === profile.key ? "bg-ink text-paper" : "hover:bg-paper-2"
                                }`}
                            >
                                {profile.label}
                            </Link>
                        ))}
                    </div>
                    <dl className="lam-spec mt-6">
                        {user ? (
                            <div>
                                <dt>Sesión</dt>
                                <dd>{user.username}</dd>
                            </div>
                        ) : null}
                        <div>
                            <dt>Herramientas</dt>
                            <dd>{tools.length} disponibles</dd>
                        </div>
                        <div>
                            <dt>Currículo</dt>
                            <dd>LOMLOE · 17 territorios · Infantil, Primaria y Secundaria</dd>
                        </div>
                        <div>
                            <dt>Datos</dt>
                            <dd>Sin nombre ni identificadores del alumnado</dd>
                        </div>
                    </dl>

                    {user ? (
                        <section className="mt-8 border-t border-ink pt-5" aria-labelledby="perfil-docente">
                            <div id="perfil-docente" className="lam-mono mb-3">Mi perfil docente</div>
                            <TeacherProfileForm />
                        </section>
                    ) : null}

                    {user ? (
                        <section className="mt-8 border-t border-ink pt-5" aria-labelledby="eliminar-cuenta">
                            <div id="eliminar-cuenta" className="lam-mono mb-2">Tu cuenta</div>
                            <p className="m-0 text-ink-2 text-[14px] leading-snug">
                                Puedes eliminar tu cuenta cuando quieras. Se borran tus clases, códigos de alumnado,
                                recursos, planificador, claves API y registros. No se puede deshacer.
                            </p>
                            <label className="block mt-3 text-[12px] font-mono uppercase tracking-[0.12em]" htmlFor="eliminar-cuenta-usuario">
                                Escribe tu usuario para confirmar
                            </label>
                            <input
                                id="eliminar-cuenta-usuario"
                                className="lam-input w-full mt-1"
                                autoComplete="off"
                                value={deleteConfirm}
                                onChange={(event) => setDeleteConfirm(event.target.value)}
                                placeholder={user.username}
                            />
                            <button
                                type="button"
                                className="lam-btn lam-btn-sm mt-3 !bg-alert !border-alert"
                                disabled={!canRequestDelete || deleting}
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                Eliminar mi cuenta
                            </button>
                            {deleteError ? <p className="m-0 mt-2 text-alert text-[13px]">{deleteError}</p> : null}
                        </section>
                    ) : null}
                </aside>
            </div>

            <ConfirmationDialog
                open={deleteDialogOpen}
                title="Eliminar tu cuenta de EDUmind"
                description="Se eliminarán de forma definitiva tu usuario y todos tus datos personales. Las aportaciones al dataset ya verificadas quedan sin autor."
                confirmLabel="Sí, eliminar mi cuenta"
                cancelLabel="Cancelar"
                destructive
                busy={deleting}
                onConfirm={() => void handleDeleteAccount()}
                onCancel={() => setDeleteDialogOpen(false)}
            />
        </main>
    );
}
