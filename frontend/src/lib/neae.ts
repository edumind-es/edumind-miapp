/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

export interface NEAELevel {
    id: string;
    label: string;
    desc: string;
}

export interface NEAECategory {
    id: string;
    name: string;
    description: string;
    levels: NEAELevel[];
}

export interface NEAECase {
    categoryId: string;
    levelId: string;
    count?: number;
    notes?: string;
}

export const NEAE_CATEGORIES: NEAECategory[] = [
    {
        id: "tdah",
        name: "TDAH",
        description: "Trastorno por Déficit de Atención e Hiperactividad",
        levels: [
            { id: "leve", label: "Apoyo puntual", desc: "Requiere adaptaciones menores y recordatorios" },
            { id: "moderado", label: "Apoyo frecuente", desc: "Necesita adaptaciones metodológicas sistemáticas" },
            { id: "intensivo", label: "Apoyo intensivo", desc: "Requiere adaptación curricular significativa" },
        ],
    },
    {
        id: "dislexia",
        name: "Dislexia",
        description: "Dificultad específica del aprendizaje de la lectura",
        levels: [
            { id: "leve", label: "Apoyo puntual", desc: "Más tiempo en lectura, recursos visuales" },
            { id: "moderado", label: "Apoyo frecuente", desc: "Textos adaptados, evaluación oral" },
            { id: "intensivo", label: "Apoyo intensivo", desc: "Materiales específicos, tecnología asistiva" },
        ],
    },
    {
        id: "tea",
        name: "TEA",
        description: "Trastorno del Espectro Autista",
        levels: [
            { id: "nivel1", label: "Nivel 1 - Apoyo", desc: "Dificultades en comunicación social, inflexibilidad" },
            { id: "nivel2", label: "Nivel 2 - Apoyo notable", desc: "Déficits marcados, comportamientos repetitivos" },
            { id: "nivel3", label: "Nivel 3 - Apoyo muy notable", desc: "Déficits severos, gran afectación" },
        ],
    },
    {
        id: "altas_capacidades",
        name: "Altas Capacidades Intelectuales",
        description: "Potencial intelectual elevado",
        levels: [
            { id: "sobredotacion", label: "Sobredotación", desc: "CI ≥130, perfil armónico" },
            { id: "talento_complejo", label: "Talento complejo", desc: "Destacan en varias áreas combinadas" },
            { id: "talento_simple", label: "Talento simple", desc: "Destacan en un área específica" },
        ],
    },
    {
        id: "discapacidad_motriz",
        name: "Discapacidad Motriz",
        description: "Diversidad funcional física",
        levels: [
            { id: "autonomo", label: "Autónomo con adaptaciones", desc: "Movilidad independiente, ajustes menores" },
            { id: "apoyo_parcial", label: "Apoyo parcial", desc: "Ayuda en algunas actividades motrices" },
            { id: "apoyo_total", label: "Apoyo constante", desc: "Asistencia en la mayoría de actividades" },
        ],
    },
    {
        id: "deficit_visual",
        name: "Déficit Visual",
        description: "Baja visión o ceguera",
        levels: [
            { id: "baja_vision_leve", label: "Baja visión leve", desc: "Materiales ampliados, iluminación" },
            { id: "baja_vision_severa", label: "Baja visión severa", desc: "Lupas, magnificadores, alto contraste" },
            { id: "ceguera", label: "Ceguera", desc: "Braille, audiodescripción, tiflotecnología" },
        ],
    },
    {
        id: "deficit_auditivo",
        name: "Déficit Auditivo",
        description: "Hipoacusia o sordera",
        levels: [
            { id: "hipoacusia_leve", label: "Hipoacusia leve", desc: "Audífonos, posición preferente" },
            { id: "hipoacusia_severa", label: "Hipoacusia severa", desc: "Apoyos visuales, subtitulado" },
            { id: "sordera", label: "Sordera", desc: "Lengua de signos, intérprete" },
        ],
    },
    {
        id: "discalculia",
        name: "Discalculia",
        description: "Dificultad específica del aprendizaje matemático",
        levels: [
            { id: "leve", label: "Apoyo puntual", desc: "Materiales manipulativos, más tiempo" },
            { id: "moderado", label: "Apoyo frecuente", desc: "Calculadora, problemas simplificados" },
            { id: "intensivo", label: "Apoyo intensivo", desc: "Adaptación curricular significativa" },
        ],
    },
    {
        id: "tanv",
        name: "TANV",
        description: "Trastorno de Aprendizaje No Verbal",
        levels: [
            { id: "leve", label: "Apoyo puntual", desc: "Instrucciones verbales claras" },
            { id: "moderado", label: "Apoyo frecuente", desc: "Evitar ambigüedades, rutinas claras" },
            { id: "intensivo", label: "Apoyo intensivo", desc: "Mediación social, apoyo emocional" },
        ],
    },
    {
        id: "discapacidad_intelectual",
        name: "Discapacidad Intelectual",
        description: "Limitaciones en funcionamiento intelectual",
        levels: [
            { id: "leve", label: "Leve", desc: "Adaptaciones metodológicas, más tiempo" },
            { id: "moderada", label: "Moderada", desc: "Adaptación curricular significativa" },
            { id: "severa", label: "Severa", desc: "Currículo muy adaptado, apoyo constante" },
        ],
    },
    {
        id: "trastorno_lenguaje",
        name: "Trastorno del Lenguaje",
        description: "Dificultades en adquisición del lenguaje",
        levels: [
            { id: "leve", label: "Leve", desc: "Apoyo logopédico puntual" },
            { id: "moderado", label: "Moderado", desc: "Intervención logopédica regular" },
            { id: "severo", label: "Severo", desc: "Sistemas aumentativos de comunicación" },
        ],
    },
];

export function formatNEAEForPrompt(cases: NEAECase[]): string {
    if (cases.length === 0) return "";

    return cases
        .map((entry) => {
            const category = NEAE_CATEGORIES.find((candidate) => candidate.id === entry.categoryId);
            const level = category?.levels.find((candidate) => candidate.id === entry.levelId);
            if (!category || !level) return "";

            let text = `${category.name} (${level.label})`;
            if (entry.count && entry.count > 1) text += ` - ${entry.count} alumnos/as`;
            if (entry.notes) text += ` - Nota: ${entry.notes}`;
            return text;
        })
        .filter(Boolean)
        .join("; ");
}
