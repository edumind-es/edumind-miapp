/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Única fuente de verdad de las herramientas: de aquí salen las rutas (App), el menú
// (Navbar) y el panel (Dashboard). Antes eran tres listas a mano que se desincronizaban:
// cinco herramientas con página y backend se quedaron sin ruta.

import type { ComponentType } from "react";

export type ToolProfile = "docente" | "opositor" | "centro";

export interface ToolDefinition {
    id: string;
    path: string;
    /** Título largo (panel). */
    title: string;
    /** Etiqueta corta (menú). */
    navLabel: string;
    desc: string;
    /** Perfiles en cuyo panel y menú aparece. Vacío = accesible por URL pero sin listar. */
    profiles: ToolProfile[];
    load: () => Promise<{ default: ComponentType }>;
    /** Requiere sesión iniciada (cualquier rol). */
    requiresAuth?: boolean;
}

export const PROFILE_LABELS: Record<ToolProfile, string> = {
    docente: "Docentes",
    opositor: "Opositores",
    centro: "Centros",
};

export const TOOLS: ToolDefinition[] = [
    // --- Docentes ---
    {
        id: "planning",
        path: "/tools/planning",
        title: "Planificación semanal",
        navLabel: "Planificación semanal",
        desc: "Construye sesiones fechadas con criterios, DUA y recursos reales de aula.",
        profiles: ["docente"],
        load: () => import("@/pages/classroom/WeeklyPlanner"),
        requiresAuth: true,
    },
    {
        id: "situation",
        path: "/tools/situation",
        title: "Situación de aprendizaje",
        navLabel: "Situación de aprendizaje",
        desc: "Crea situaciones de aprendizaje LOMLOE.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/SituationTool"),
    },
    {
        id: "stem",
        path: "/tools/stem",
        title: "Proyectos STEM",
        navLabel: "Proyecto STEM",
        desc: "Diseña proyectos Maker y Polos Creativos.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/StemTool"),
    },
    {
        id: "diversity",
        path: "/tools/diversity",
        title: "Plan de inclusión",
        navLabel: "Atención a la diversidad",
        desc: "Intervención para NEAE y diversidad.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/DiversityTool"),
    },
    {
        id: "reinforcement_plan",
        path: "/tools/reinforcement_plan",
        title: "Plan de refuerzo",
        navLabel: "Plan de refuerzo",
        desc: "Plan de refuerzo anónimo con base curricular oficial.",
        profiles: ["docente", "centro"],
        load: () => import("@/pages/tools/ReinforcementPlanTool"),
    },
    {
        id: "session",
        path: "/tools/session",
        title: "Diseño de sesiones",
        navLabel: "Sesión",
        desc: "Planificación detallada sesión a sesión.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/SessionTool"),
    },
    {
        id: "rubrics",
        path: "/tools/rubrics",
        title: "Rúbricas de evaluación",
        navLabel: "Rúbricas",
        desc: "Rúbricas precisas exportables a CSV para iDoceo o Additio.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/RubricsTool"),
    },
    {
        id: "worksheets",
        path: "/tools/worksheets",
        title: "Fichas y material imprimible",
        navLabel: "Fichas",
        desc: "Fichas de repaso, cuestionarios y material didáctico imprimible.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/WorksheetsTool"),
    },
    {
        id: "questions",
        path: "/tools/questions",
        title: "Baterías de preguntas (GIFT)",
        navLabel: "Preguntas GIFT",
        desc: "Preguntas compatibles con Moodle listas para importar.",
        profiles: ["docente"],
        load: () => import("@/pages/tools/QuestionTool"),
    },
    // Con página y backend operativos, pero sin listar hasta decidir si se mantienen.
    {
        id: "methodology",
        path: "/tools/methodology",
        title: "Asesor metodológico",
        navLabel: "Asesor metodológico",
        desc: "Compara enfoques pedagógicos para un mismo contenido.",
        profiles: [],
        load: () => import("@/pages/tools/MethodologyTool"),
    },
    {
        id: "organization",
        path: "/tools/organization",
        title: "Organización de espacios",
        navLabel: "Organización de espacios",
        desc: "Distribución del aula para aprendizaje e inclusión (DUA).",
        profiles: [],
        load: () => import("@/pages/tools/OrganizationTool"),
    },
    {
        id: "planning_ai",
        path: "/tools/planning-ai",
        title: "Planificación didáctica (IA)",
        navLabel: "Planificación didáctica",
        desc: "Propuesta didáctica generada por IA a partir de curso, horas y objetivo.",
        profiles: [],
        load: () => import("@/pages/tools/PlanningTool"),
    },
    // --- Opositores ---
    {
        id: "case",
        path: "/tools/case",
        title: "Supuestos prácticos",
        navLabel: "Supuesto práctico",
        desc: "Entrenamiento y resolución de casos.",
        profiles: ["opositor"],
        load: () => import("@/pages/tools/CaseTool"),
    },
    {
        id: "topic",
        path: "/tools/topic",
        title: "Desarrollo de temas",
        navLabel: "Tema",
        desc: "Generación de temas de estudio.",
        profiles: ["opositor"],
        load: () => import("@/pages/tools/TopicTool"),
    },
    {
        id: "defense",
        path: "/tools/defense",
        title: "Defensa oral",
        navLabel: "Defensa",
        desc: "Preparación de la defensa y debate.",
        profiles: ["opositor"],
        load: () => import("@/pages/tools/DefenseTool"),
    },
    {
        id: "idea",
        path: "/tools/idea",
        title: "Mentor y lluvia de ideas",
        navLabel: "Consulta rápida",
        desc: "Consultas creativas para tu oposición.",
        profiles: ["opositor"],
        load: () => import("@/pages/tools/IdeaTool"),
    },
    // --- Centros ---
    {
        id: "minutes",
        path: "/tools/minutes",
        title: "Actas de reunión",
        navLabel: "Actas",
        desc: "Redacción formal de actas (claustro, CCP...).",
        profiles: ["centro"],
        load: () => import("@/pages/tools/MinutesTool"),
    },
    {
        id: "institution_doc",
        path: "/tools/institution_doc",
        title: "Documentación institucional",
        navLabel: "Documento institucional",
        desc: "PGA, RRI, planes de centro...",
        profiles: ["centro"],
        load: () => import("@/pages/tools/InstitutionDocTool"),
    },
    {
        id: "inspection_report",
        path: "/tools/inspection_report",
        title: "Inspección educativa",
        navLabel: "Inspección educativa",
        desc: "Informes, actas y respuestas técnicas para requerimientos de inspección.",
        profiles: ["centro"],
        load: () => import("@/pages/tools/InspectionReportTool"),
    },
    {
        id: "normativa",
        path: "/tools/normativa",
        title: "Aplicación normativa",
        navLabel: "Aplicación normativa",
        desc: "Consultas legales sobre convivencia (Galicia).",
        profiles: ["centro"],
        load: () => import("@/pages/tools/NormativaTool"),
    },
];

export function toolsForProfile(profile: ToolProfile): ToolDefinition[] {
    return TOOLS.filter((tool) => tool.profiles.includes(profile));
}

export function toolSections(): Array<{ profile: ToolProfile; label: string; tools: ToolDefinition[] }> {
    return (Object.keys(PROFILE_LABELS) as ToolProfile[]).map((profile) => ({
        profile,
        label: PROFILE_LABELS[profile],
        tools: toolsForProfile(profile),
    }));
}
