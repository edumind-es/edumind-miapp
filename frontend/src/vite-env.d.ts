/// <reference types="vite/client" />

// Variables de entorno que lee el frontend en tiempo de build (prefijo VITE_).
interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_ADMIN_PORTAL_PATH?: string;
    /** Espejo propio de los pesos del modelo WebLLM (ver scripts/mirror_webllm_model.sh). */
    readonly VITE_WEBLLM_MODEL_URL?: string;
    /** Espejo propio del wasm del modelo WebLLM. */
    readonly VITE_WEBLLM_MODEL_LIB_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
