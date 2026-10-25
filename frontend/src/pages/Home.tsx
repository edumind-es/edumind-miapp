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

// Inicio en modo EDUmind-Lámina: titular a la izquierda, lista de filete con los
// perfiles, ficha técnica en columna derecha y panel pentagonal de los cinco mundos.

import { Link } from "react-router-dom";

const PROFILES = [
    {
        num: "01",
        to: "/dashboard?role=docente",
        title: "Docentes",
        description: "Situaciones de aprendizaje, planes de refuerzo, sesiones y materiales alineados con el currículo oficial.",
    },
    {
        num: "02",
        to: "/dashboard?role=opositor",
        title: "Opositores",
        description: "Supuestos prácticos, desarrollo de temas y entrenamiento de la defensa con retroalimentación experta.",
    },
    {
        num: "03",
        to: "/dashboard?role=centro",
        title: "Centros",
        description: "Actas, documentación institucional, respuestas a inspección y aplicación normativa.",
    },
];

const WORLDS = [
    { key: "emocional", label: "Emocional", color: "var(--m-emocional)" },
    { key: "social", label: "Social", color: "var(--m-social)" },
    { key: "fisico", label: "Físico", color: "var(--m-fisico)" },
    { key: "mental", label: "Mental", color: "var(--m-mental)" },
    { key: "interior", label: "Interior", color: "var(--m-interior)" },
];

// Vértices de un pentágono regular (centro 60,60 · radio 44), empezando arriba
const PENTAGON = [
    [60, 16],
    [101.8, 46.4],
    [85.9, 95.6],
    [34.1, 95.6],
    [18.2, 46.4],
] as const;

function WorldsPanel() {
    return (
        <div className="lam-panel">
            <div className="lam-panel-head">
                <span className="lam-mono lam-mono-ink">Los cinco mundos</span>
                <span className="lam-mono">5 / 5</span>
            </div>
            <div className="flex items-center gap-5">
                <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" className="shrink-0">
                    <polygon
                        points={PENTAGON.map((p) => p.join(",")).join(" ")}
                        fill="none"
                        stroke="var(--ink)"
                        strokeWidth="1"
                    />
                    {PENTAGON.map(([x, y], i) => (
                        <line key={`r${i}`} x1="60" y1="60" x2={x} y2={y} stroke="var(--hair)" strokeWidth="1" />
                    ))}
                    {PENTAGON.map(([x, y], i) => (
                        <circle key={`p${i}`} cx={x} cy={y} r="5" fill={WORLDS[i].color} />
                    ))}
                </svg>
                <ul className="m-0 p-0 list-none">
                    {WORLDS.map((world) => (
                        <li key={world.key} className="flex items-center gap-3 py-1 text-[13px]">
                            <i className="inline-block w-2.5 h-2.5" style={{ background: world.color }} />
                            {world.label}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default function Home() {
    return (
        <main className="lam-wrap pb-16">
            <section className="lam-cols pt-12">
                <div>
                    <p className="lam-eyebrow mb-4">EDUmind · Plataforma docente · IA local y en la nube</p>
                    <h1 className="lam-h1 max-w-[12ch] mb-6">
                        MiApp <span className="light">EDUmind</span>
                    </h1>
                    <p className="lam-lede mb-8">
                        Genera recursos didácticos, prepara oposiciones y gestiona la documentación de centro
                        sobre el currículo oficial de tu comunidad.
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                        <Link to="/chat" className="lam-btn">Abrir el chat IA</Link>
                        <span className="lam-stamp">Beta · Marca registrada OEPM</span>
                    </div>

                    <div className="flex flex-wrap border-t border-hair mt-9">
                        {["Sin rastreadores", "IA local, servidor EDUmind o clave propia", "Currículo LOMLOE autonómico"].map((item) => (
                            <span
                                key={item}
                                className="font-mono text-[13px] text-ink-2 py-3.5 pr-5 mr-5 border-r border-hair last:border-r-0"
                            >
                                {item}
                            </span>
                        ))}
                    </div>

                    <section className="mt-16">
                        <div className="lam-sec-head">
                            <span className="lam-sec-num">01</span>
                            <h2>Elige tu perfil</h2>
                        </div>
                        <ul className="lam-rules">
                            {PROFILES.map((profile) => (
                                <li key={profile.to} className="!py-5">
                                    <span className="font-sans font-extrabold text-[28px] leading-none text-mental w-12 shrink-0 pt-1">
                                        {profile.num}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="m-0 text-[20px] font-bold">{profile.title}</h3>
                                        <p className="m-0 mt-1 text-ink-2 max-w-[60ch]">{profile.description}</p>
                                    </div>
                                    <Link to={profile.to} className="lam-btn lam-btn-sm lam-btn-ghost self-center shrink-0">
                                        Entrar
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>

                <aside className="lam-aside">
                    <Link to="/dashboard" className="lam-btn lam-btn-block">Ir al panel</Link>
                    <dl className="lam-spec mt-6">
                        <div>
                            <dt>Público</dt>
                            <dd>Docentes, opositores y equipos directivos</dd>
                        </div>
                        <div>
                            <dt>Marco</dt>
                            <dd>LOMLOE · currículos autonómicos</dd>
                        </div>
                        <div>
                            <dt>Modelos</dt>
                            <dd>Local en tu navegador, servidor EDUmind o clave propia (con aviso de dónde se procesa)</dd>
                        </div>
                        <div>
                            <dt>Privacidad</dt>
                            <dd>Sin rastreadores. El alumnado se gestiona solo con códigos, nunca con nombres</dd>
                        </div>
                        <div>
                            <dt>Autoría</dt>
                            <dd>EDUmind® · Luis Vilela Acuña</dd>
                        </div>
                    </dl>
                    <div className="mt-6">
                        <WorldsPanel />
                    </div>
                </aside>
            </section>
        </main>
    );
}
