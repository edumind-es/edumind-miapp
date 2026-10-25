#!/usr/bin/env bash
# Espejo local del modelo WebLLM (pesos + wasm) para servirlo desde EDUmind.
#
# Hoy el navegador descarga Llama 3.2 1B de Hugging Face y el wasm de GitHub (rama
# mutable, sin integridad). Este script copia ambos a un directorio que nginx sirve
# en /models/ y deja un fichero SHA256SUMS para poder verificar la copia.
#
# Uso:  ./scripts/mirror_webllm_model.sh [destino]   (por defecto /var/www/edumind_models/webllm)
# Después, en el build del frontend:
#   VITE_WEBLLM_MODEL_URL=https://miapp.edumind.es/models/Llama-3.2-1B-Instruct-q4f32_1-MLC
#   VITE_WEBLLM_MODEL_LIB_URL=https://miapp.edumind.es/models/lib/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm
set -euo pipefail

MODEL_ID="Llama-3.2-1B-Instruct-q4f32_1-MLC"
HF_REPO="mlc-ai/${MODEL_ID}"
WEBLLM_VERSION="v0_2_80"   # debe coincidir con @mlc-ai/web-llm del frontend (modelVersion)
WASM_NAME="Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm"
WASM_URL="https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${WEBLLM_VERSION}/${WASM_NAME}"

DEST="${1:-/var/www/edumind_models/webllm}"
MODEL_DIR="${DEST}/${MODEL_ID}/resolve/main"
LIB_DIR="${DEST}/lib"

command -v curl >/dev/null || { echo "Falta curl" >&2; exit 1; }
command -v python3 >/dev/null || { echo "Falta python3" >&2; exit 1; }

mkdir -p "${MODEL_DIR}" "${LIB_DIR}"

echo "Listando ficheros de ${HF_REPO}..."
FILES=$(curl -fsSL "https://huggingface.co/api/models/${HF_REPO}" \
  | python3 -c 'import json,sys; print("\n".join(s["rfilename"] for s in json.load(sys.stdin)["siblings"]))')

for f in ${FILES}; do
  case "$f" in .gitattributes|README.md) continue ;; esac
  if [ -s "${MODEL_DIR}/${f}" ]; then echo "  ya existe: $f"; continue; fi
  echo "  descargando: $f"
  curl -fsSL --retry 3 -o "${MODEL_DIR}/${f}" "https://huggingface.co/${HF_REPO}/resolve/main/${f}"
done

echo "Descargando wasm ${WASM_NAME}..."
curl -fsSL --retry 3 -o "${LIB_DIR}/${WASM_NAME}" "${WASM_URL}"

( cd "${DEST}" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
echo
echo "Espejo listo en ${DEST} ($(du -sh "${DEST}" | cut -f1)). Sumas en ${DEST}/SHA256SUMS."
echo "WebLLM pide los pesos como <VITE_WEBLLM_MODEL_URL>/resolve/main/<fichero>: la ruta ya tiene esa forma."
