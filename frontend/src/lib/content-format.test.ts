import { describe, expect, it } from "vitest";
import { cleanGeneratedText } from "./content-format";

describe("cleanGeneratedText", () => {
    it("elimina razonamiento interno y tokens especiales", () => {
        expect(cleanGeneratedText("<think>pensando</think>Hola<|eot_id|>")).toBe("Hola");
    });
    it("desenvuelve un bloque de código que ocupa toda la salida", () => {
        expect(cleanGeneratedText("```json\n{\"a\": 1}\n```")).toBe('{"a": 1}');
    });
    it("normaliza saltos de línea y espacios sobrantes", () => {
        expect(cleanGeneratedText("a\r\n\r\n\r\n\r\nb\n")).toBe("a\n\nb");
    });
});
