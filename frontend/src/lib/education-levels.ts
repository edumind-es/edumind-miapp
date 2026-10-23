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

// Spanish Education System Levels

export const EDUCATION_LEVELS = [
    {
        stage: "Infantil",
        courses: ["3 años", "4 años", "5 años"]
    },
    {
        stage: "Primaria",
        courses: ["1º Primaria", "2º Primaria", "3º Primaria", "4º Primaria", "5º Primaria", "6º Primaria"]
    },
    {
        stage: "ESO",
        courses: ["1º ESO", "2º ESO", "3º ESO", "4º ESO"]
    },
    {
        stage: "Bachillerato",
        courses: ["1º Bachillerato", "2º Bachillerato"]
    },
    {
        stage: "FP Básica",
        courses: ["1º FP Básica", "2º FP Básica"]
    },
    {
        stage: "FP Grado Medio",
        courses: ["1º CFGM", "2º CFGM"]
    },
    {
        stage: "FP Grado Superior",
        courses: ["1º CFGS", "2º CFGS"]
    },
    {
        stage: "Universidad",
        courses: ["Grado", "Máster", "Doctorado"]
    },
    {
        stage: "Educación de Adultos",
        courses: ["Adultos"]
    }
];

// Flatten all courses for quick select
export const ALL_COURSES = EDUCATION_LEVELS.flatMap(level =>
    level.courses.map(course => `${course} (${level.stage})`)
);

// Get stage from course string
export function getStageFromCourse(courseString: string): string {
    const match = courseString.match(/\(([^)]+)\)/);
    return match ? match[1] : "";
}
