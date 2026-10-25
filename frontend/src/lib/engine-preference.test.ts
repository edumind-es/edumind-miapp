import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_ENGINE, acknowledgeEngine, getInitialEngine, hasAcknowledgedEngine, rememberEngine } from "./engine-preference";

describe("engine-preference", () => {
    beforeEach(() => localStorage.clear());

    it("arranca en el motor local si no hay preferencia", () => {
        expect(DEFAULT_ENGINE).toBe("webgpu");
        expect(getInitialEngine()).toBe("webgpu");
    });
    it("recuerda la elección del usuario", () => {
        rememberEngine("edumind");
        expect(getInitialEngine()).toBe("edumind");
    });
    it("recuerda qué avisos de privacidad se han aceptado", () => {
        expect(hasAcknowledgedEngine("chatgpt")).toBe(false);
        acknowledgeEngine("chatgpt");
        expect(hasAcknowledgedEngine("chatgpt")).toBe(true);
        expect(hasAcknowledgedEngine("claude")).toBe(false);
    });
});
