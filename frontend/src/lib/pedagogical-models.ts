/*
 * Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
 * Author: Luis Vilela Acuña
 */

export interface PedagogicalModelOption {
    id: string;
    name: string;
    desc: string;
}

export const PEDAGOGICAL_MODELS: PedagogicalModelOption[] = [
    { id: "constructivista", name: "Constructivista", desc: "Aprendizaje basado en la construcción activa del conocimiento" },
    { id: "conductista", name: "Conductista", desc: "Enfoque en estímulo-respuesta y refuerzo" },
    { id: "cognitivista", name: "Cognitivista", desc: "Centrado en procesos mentales y estructuras de pensamiento" },
    { id: "conectivista", name: "Conectivista", desc: "Aprendizaje en red y era digital" },
    { id: "montessori", name: "Montessori", desc: "Autonomía, ambiente preparado y materiales manipulativos" },
    { id: "waldorf", name: "Waldorf/Steiner", desc: "Desarrollo integral: cabeza, corazón y manos" },
    { id: "reggio_emilia", name: "Reggio Emilia", desc: "El niño como protagonista, cien lenguajes" },
    { id: "abp", name: "ABP (Aprendizaje Basado en Proyectos)", desc: "Proyectos reales como eje del aprendizaje" },
    { id: "abs", name: "ABS (Aprendizaje Basado en Servicios)", desc: "Aprendizaje vinculado a servicio comunitario" },
    { id: "aula_invertida", name: "Aula Invertida (Flipped Classroom)", desc: "Contenido en casa, práctica en clase" },
    { id: "gamificacion", name: "Gamificación", desc: "Mecánicas de juego aplicadas al aprendizaje" },
    { id: "design_thinking", name: "Design Thinking", desc: "Pensamiento de diseño y resolución creativa" },
    { id: "cooperativo", name: "Aprendizaje Cooperativo", desc: "Interdependencia positiva en grupos" },
    { id: "visible_thinking", name: "Pensamiento Visible", desc: "Rutinas de pensamiento y metacognición" },
    { id: "inteligencias_multiples", name: "Inteligencias Múltiples", desc: "Gardner: diversidad de capacidades" },
    { id: "enseñanza_directa", name: "Enseñanza Directa", desc: "Instrucción explícita estructurada" },
    { id: "hibrid", name: "Modelo Híbrido/Ecléctico", desc: "Combinación de varios enfoques según necesidad" },
];

export function getModelDisplayName(id: string, customValue?: string): string {
    if (id === "otro" && customValue) return customValue;
    const model = PEDAGOGICAL_MODELS.find((entry) => entry.id === id);
    return model ? `${model.name}: ${model.desc}` : id;
}
