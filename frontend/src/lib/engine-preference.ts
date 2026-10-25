// Motor de IA inicial y preferencia del usuario.
// Por defecto se usa el motor local (WebGPU): nada sale del dispositivo.
// Solo se guarda el identificador del motor en el navegador, nunca claves.

export const DEFAULT_ENGINE = "webgpu";

const STORAGE_KEY = "edumind_engine";

export function getInitialEngine(): string {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && /^[a-z0-9_-]{2,32}$/i.test(stored)) {
            return stored;
        }
    } catch {
        // Almacenamiento no disponible (modo privado, bloqueado): usar el defecto
    }
    return DEFAULT_ENGINE;
}

export function rememberEngine(engineId: string): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, engineId);
    } catch {
        // Sin persistencia: la elección vale solo para esta pantalla
    }
}

// Aviso de procesamiento aceptado por motor (solo identificadores).
const ACK_KEY = "edumind_engine_ack";

function readAcks(): string[] {
    try {
        const raw = window.localStorage.getItem(ACK_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
        return [];
    }
}

export function hasAcknowledgedEngine(engineId: string): boolean {
    return readAcks().includes(engineId);
}

export function acknowledgeEngine(engineId: string): void {
    try {
        const acks = readAcks();
        if (!acks.includes(engineId)) acks.push(engineId);
        window.localStorage.setItem(ACK_KEY, JSON.stringify(acks));
    } catch {
        // Sin persistencia: se volverá a mostrar el aviso en la próxima sesión
    }
}
