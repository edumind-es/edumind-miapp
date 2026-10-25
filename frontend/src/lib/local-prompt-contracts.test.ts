import { describe, expect, it } from "vitest";
import {
    LocalPromptValidationError,
    sanitizePayloadLocally,
    validatePayloadLocally,
    type LocalToolContract,
} from "./local-prompt-contracts";

const placeholders = new Set(["no especificado", "n a", "pendiente"]);

const planning: LocalToolContract = {
    tool: "planning",
    prompt_id: "planning_v1",
    version: "1",
    risk_level: "medium",
    supports_json: false,
    default_response_format: "text",
    output_schema: null,
    required_fields: { curso: "curso", horas: "horas", objetivo: "objetivo" },
    positive_fields: { horas: "horas" },
};

describe("sanitizePayloadLocally", () => {
    it("recorta, quita vacíos y placeholders y neutraliza bloques de código", () => {
        const result = sanitizePayloadLocally(
            { curso: "  6º  ", objetivo: "No especificado", notas: "", lista: ["", "a", "n/a"], texto: "```x```" },
            placeholders
        );
        expect(result).toEqual({ curso: "6º", lista: ["a"], texto: "'''x'''" });
    });
});

describe("validatePayloadLocally", () => {
    it("exige los campos obligatorios con el mismo mensaje que el backend", () => {
        expect(() => validatePayloadLocally(planning, { curso: "6º" }, placeholders)).toThrowError(
            new LocalPromptValidationError("Faltan datos obligatorios para generar un resultado fiable: horas, objetivo.")
        );
    });
    it("exige números positivos donde toca", () => {
        expect(() =>
            validatePayloadLocally(planning, { curso: "6º", horas: "0", objetivo: "Saltar" }, placeholders)
        ).toThrowError(/mayores que cero: horas/);
        expect(() =>
            validatePayloadLocally(planning, { curso: "6º", horas: "2,5 h", objetivo: "Saltar" }, placeholders)
        ).not.toThrow();
    });
});
