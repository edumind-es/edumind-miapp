# edumind_miapp — Contexto del proyecto

## Qué es
App principal del ecosistema EDUmind. Backend Python/FastAPI con base de conocimiento propia y modelos LoRA. Frontend React/Vite con Tailwind.

## Arquitectura
edumind_miapp/
├── backend/          ← FastAPI (Python). Punto de entrada: main.py
│   ├── app/          ← rutas, modelos, lógica
│   ├── knowledge/    ← base de conocimiento (NO modificar sin confirmar)
│   ├── modelos_lora/ ← modelos fine-tuned (NO tocar nunca)
│   ├── migrations/   ← Alembic DB migrations
│   └── edumind.db    ← SQLite principal (NO borrar nunca)
├── frontend/         ← React + Vite + Tailwind
│   └── src/          ← código fuente frontend
├── scripts/          ← scripts de mantenimiento
├── ops/              ← configuración operacional
└── deploy.sh         ← deploy estándar
## Comandos habituales
- Backend dev: `cd backend && uvicorn main:app --reload`
- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Deploy: `./deploy.sh` (pedir confirmación antes)
- Tests backend: `cd backend && pytest`

## Archivos críticos — pedir confirmación SIEMPRE antes de tocar
- `backend/edumind.db` — base de datos principal
- `backend/knowledge/` — base de conocimiento
- `backend/modelos_lora/` — modelos entrenados
- `backend/migrations/` — migraciones DB
- `nginx_production.conf` — configuración nginx producción
- `deploy.sh` / `deploy_pro.sh` — scripts de deploy

## Dónde ir según la tarea
- Nueva ruta API → `backend/app/`
- Cambio de UI → `frontend/src/`
- Problema de DB → `backend/migrations/` + confirmar con Luis
- Script mantenimiento → `scripts/`
- Documentación → `docs/`

## Lo que NO hacer
- No ejecutar deploy sin confirmación explícita
- No modificar edumind.db directamente
- No tocar modelos_lora bajo ningún concepto
- No hacer `npm install` ni `pip install` sin avisar
- No leer archivos en `backend/dataset/` (son grandes, no suelen ser necesarios)
