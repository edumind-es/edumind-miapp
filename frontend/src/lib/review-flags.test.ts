import { describe, expect, it } from "vitest";
import { detectReviewFlags } from "./content-format";

describe("detectReviewFlags", () => {
    it("lee requiere_revision_humana y la revisión curricular en salidas JSON", () => {
        const flags = detectReviewFlags(
            JSON.stringify({ respuesta: "x", requiere_revision_humana: true, _revision_curricular: { codigos_no_encontrados: ["CE9.9"] } })
        );
        expect(flags.humanReview).toBe(true);
        expect(flags.unknownCurriculumCodes).toEqual(["CE9.9"]);
    });
    it("lee la línea de revisión curricular en texto plano", () => {
        const flags = detectReviewFlags(
            "Sesión...\n\n[Revisión curricular]: códigos citados que no existen en la matriz galicia/primaria/educacion-fisica/5o: CE8.7, B7.4. Revísalos antes de usar el documento.\n"
        );
        expect(flags.humanReview).toBe(false);
        expect(flags.unknownCurriculumCodes).toEqual(["CE8.7", "B7.4"]);
    });
    it("no marca nada en una salida limpia", () => {
        expect(detectReviewFlags("Todo correcto con CE1.1")).toEqual({ humanReview: false, unknownCurriculumCodes: [] });
    });
});
