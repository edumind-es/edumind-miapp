# FASE 8 | Gobernanza de contenido y capa anti-alucinación

Fecha de cierre inicial: `2026-04-09`

## Objetivo

Reducir alucinación, bloquear payloads incompletos antes de construir prompts, y presentar salidas estructuradas sin exponer al usuario JSON crudo o residuos internos del modelo.

## Cambios ejecutados

- validación previa por herramienta en `backend/app/core/prompt_registry.py`
  - bloqueo de campos vacíos o placeholder (`No especificado`, `pendiente`, `n/a`, etc.)
  - validación de campos numéricos positivos en herramientas que lo necesitan
  - rechazo explícito cuando una generación no tiene datos mínimos fiables
- salida estructurada por defecto en herramientas de mayor riesgo:
  - `case`
  - `defense`
  - `inspection_report`
  - `reinforcement_plan`
  - `normativa`
- nuevos contratos JSON y validación server-side en `backend/app/api/v1/generators.py`
  - extracción robusta del bloque JSON incluso si el proveedor envuelve la respuesta
  - validación de schema antes de considerar la salida publicable
  - error controlado cuando la respuesta no es publicable
- endurecimiento de esquemas backend en `backend/app/schemas.py`
  - `response_format=json` por defecto en herramientas de alto riesgo
- mejora de presentación en `frontend/src/components/FormattedContent.tsx`
  - renderizado semántico de objetos y listas JSON
  - badges para booleanos
  - secciones legibles en lugar de “bloques de código”
- rediseño seguro de `generators/render/{tool}`
  - el backend ya no expone `prompt_text`
  - el endpoint devuelve solo contrato publico, payload saneado y schema
  - WebGPU local construye el prompt desde plantillas seguras en cliente
- cobertura de regresión en `backend/tests/test_generators.py`
  - rechazo de payloads placeholder
  - default JSON en herramientas sensibles
  - validación y pretty-print de JSON correcto
  - rechazo de estructura inválida

## Verificación

- `scripts/phase8_verify.sh`
- backend específico de generadores: `44 passed`
- backend generadores + prompt registry: `52 passed`
- `npm run lint` OK
- `npm run build` OK

## Cierre

La fase queda cerrada sin exposición de prompting interno en el flujo de render local. El endpoint de render permanece por compatibilidad funcional, pero ahora actúa como validador/normalizador y no como canal de fuga de lógica interna.
