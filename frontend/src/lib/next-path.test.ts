import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./next-path";

describe("sanitizeNextPath", () => {
    it("acepta rutas internas", () => {
        expect(sanitizeNextPath("/tools/session?x=1")).toBe("/tools/session?x=1");
    });
    it("rechaza redirecciones externas y rutas de API", () => {
        expect(sanitizeNextPath("//evil.com")).toBe("/dashboard");
        expect(sanitizeNextPath("https://evil.com")).toBe("/dashboard");
        expect(sanitizeNextPath("/api/v1/auth/me")).toBe("/dashboard");
    });
    it("rechaza barras invertidas y caracteres de control", () => {
        expect(sanitizeNextPath("/\\evil.com")).toBe("/dashboard");
        expect(sanitizeNextPath("/dash\nboard")).toBe("/dashboard");
    });
    it("usa el destino por defecto si no hay valor", () => {
        expect(sanitizeNextPath(null)).toBe("/dashboard");
        expect(sanitizeNextPath("", "/classroom")).toBe("/classroom");
    });
});
