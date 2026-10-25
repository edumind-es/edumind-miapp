import { describe, expect, it } from "vitest";
import { buildSafeLocalPrompt } from "./local-prompt-builder";

describe("buildSafeLocalPrompt", () => {
    const base = {
        tool: "questions",
        prompt_id: "assessment.questions",
        prompt_version: "2.0.0",
        risk_level: "high",
        response_format: "text",
        output_schema: null,
        sanitized_payload: { texto_fuente: "La célula", cantidad: 5 },
        local_prompt_mode: "client_template_v2",
    };

    it("usa la especificación servida por el backend", () => {
        const prompt = buildSafeLocalPrompt({
            ...base,
            spec: { label: "Banco de preguntas (GIFT)", objective: "Preguntas GIFT para Moodle.", sections: ["Preguntas GIFT"], rules: ["Solo GIFT."] },
            text_quality: false,
        });
        expect(prompt).toContain("Herramienta: Banco de preguntas (GIFT)");
        expect(prompt).toContain("1. Preguntas GIFT");
        expect(prompt).toContain("- Solo GIFT.");
        expect(prompt).toContain("La célula");
        expect(prompt).not.toContain("CALIDAD DE LA RESPUESTA");
    });

    it("cae a una especificación genérica si el backend no envía ninguna", () => {
        const prompt = buildSafeLocalPrompt({ ...base, text_quality: true });
        expect(prompt).toContain("Herramienta: questions");
        expect(prompt).toContain("Desarrollo principal");
        expect(prompt).toContain("CALIDAD DE LA RESPUESTA");
    });
});
