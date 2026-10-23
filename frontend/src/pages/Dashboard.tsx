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

import { Link, useSearchParams } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";

interface Tool {
    id: string;
    title: string;
    desc: string;
    link: string;
}

const TOOLS: Record<"docente" | "opositor" | "centro", Tool[]> = {
    docente: [
        { id: "planning", title: "Planificación semanal", desc: "Construye sesiones fechadas con criterios, DUA y recursos reales de aula.", link: "/tools/planning" },
        { id: "situation", title: "Situación de aprendizaje", desc: "Crea situaciones de aprendizaje LOMLOE.", link: "/tools/situation" },
        { id: "stem", title: "Proyectos STEM", desc: "Diseña proyectos Maker y Polos Creativos.", link: "/tools/stem" },
        { id: "diversity", title: "Plan de inclusión", desc: "Intervención para NEAE y diversidad.", link: "/tools/diversity" },
        { id: "reinforcement_plan", title: "Plan de refuerzo", desc: "Plan de refuerzo anónimo con base curricular oficial.", link: "/tools/reinforcement_plan" },
        { id: "session", title: "Diseño de sesiones", desc: "Planificación detallada sesión a sesión.", link: "/tools/session" },
    ],
    opositor: [
        { id: "case", title: "Supuestos prácticos", desc: "Entrenamiento y resolución de casos.", link: "/tools/case" },
        { id: "topic", title: "Desarrollo de temas", desc: "Generación de temas de estudio.", link: "/tools/topic" },
        { id: "defense", title: "Defensa oral", desc: "Preparación de la defensa y debate.", link: "/tools/defense" },
        { id: "idea", title: "Mentor y lluvia de ideas", desc: "Consultas creativas para tu oposición.", link: "/tools/idea" },
    ],
    centro: [
        { id: "minutes", title: "Actas de reunión", desc: "Redacción formal de actas (claustro, CCP...).", link: "/tools/minutes" },
        { id: "institution_doc", title: "Documentación institucional", desc: "PGA, RRI, planes de centro...", link: "/tools/institution_doc" },
        { id: "inspection_report", title: "Inspección educativa", desc: "Informes, actas y respuestas técnicas para requerimientos de inspección.", link: "/tools/inspection_report" },
        { id: "reinforcement_plan", title: "Plan de refuerzo", desc: "Plan de refuerzo por área con enfoque privacy-first y seguimiento.", link: "/tools/reinforcement_plan" },
        { id: "normativa", title: "Aplicación normativa", desc: "Consultas legales sobre convivencia (Galicia).", link: "/tools/normativa" },
    ],
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
    const { user } = useAuthSession();
    const [searchParams] = useSearchParams();
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
                                        <Link to={tool.link} className="no-underline hover:underline underline-offset-4">
                                            {tool.title}
                                        </Link>
                                    </h2>
                                    <p className="m-0 mt-1 text-ink-2 max-w-[60ch]">{tool.desc}</p>
                                </div>
                                <Link to={tool.link} className="lam-btn lam-btn-sm lam-btn-ghost self-center shrink-0">
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
                </aside>
            </div>
        </main>
    );
}
