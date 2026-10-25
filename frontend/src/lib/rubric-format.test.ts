import { describe, expect, it } from "vitest";
import { parseRubric, rubricToCsv, rubricToPlainText } from "./rubric-format";

const salida = JSON.stringify({
    titulo: "Debate",
    area: "Lengua",
    niveles: ["Insuficiente", "Suficiente", "Notable", "Sobresaliente"],
    criterios: [
        { criterio: "Argumenta con \"datos\"", codigo_curricular: "CE2.1", descriptores: ["a", "b", "c", "d"], peso: 50 },
        { criterio: "Escucha activa", descriptores: ["e", "f", "g", "h"], peso: 50 },
    ],
    requiere_revision_humana: false,
});

describe("rubric-format", () => {
    it("lee la rúbrica JSON y descarta texto que no lo es", () => {
        const rubric = parseRubric("```json\n" + salida + "\n```");
        expect(rubric?.criterios).toHaveLength(2);
        expect(rubric?.criterios[0].codigo_curricular).toBe("CE2.1");
        expect(rubric?.criterios[1].codigo_curricular).toBeUndefined();
        expect(parseRubric("Criterio,Nivel 1,Nivel 2")).toBeNull();
    });
    it("genera CSV con punto y coma, BOM y comillas escapadas", () => {
        const csv = rubricToCsv(parseRubric(salida)!);
        expect(csv.startsWith("﻿\"Criterio\";\"Código curricular\";\"Insuficiente\"")).toBe(true);
        expect(csv).toContain('"Argumenta con ""datos""";"CE2.1";"a";"b";"c";"d";"50"');
    });
    it("genera texto plano con un bloque por criterio", () => {
        const texto = rubricToPlainText(parseRubric(salida)!);
        expect(texto).toContain("1. ARGUMENTA CON \"DATOS\" (CE2.1) · 50 %");
        expect(texto).toContain("- Notable: c");
    });
});
