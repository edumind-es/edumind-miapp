# EDUmind MiApp

Aplicación educativa con asistente IA local para educación.

## Tecnología
- **Backend:** FastAPI + Python
- **Frontend:** React + TypeScript
- **IA:** EDUmind Core + Ollama (Gemma 4 E4B)
- **Persistencia:** PostgreSQL + Alembic

## Instalación

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Desarrollo

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8003

# Frontend
cd frontend && npm run dev
```

## Despliegue

```bash
# preflight + backup + build + migraciones + reload + smoke
./deploy.sh

# despliegue con apertura publica al final
./deploy_pro.sh --activate-public
```

El despliegue aplica `preflight`, backup, migraciones, recarga del runtime y smoke post-deploy.

Operaciones complementarias:

```bash
# dejar el edge publico en mantenimiento
./scripts/cutover_enable_maintenance.sh

# abrir el edge publico
./scripts/cutover_activate_public.sh

# smoke local/publico segun estado esperado
./scripts/post_deploy_smoke.sh --public-mode maintenance
./scripts/post_deploy_smoke.sh --public-mode live
```

## Tests

```bash
./scripts/phase10_verify.sh
```

## Servicio

- **Puerto:** 8100
- **URL:** https://miapp.edumind.es
- **Base de datos:** PostgreSQL local en `127.0.0.1:5435`
- Worker de entrenamiento LoRA: `backend/scripts/training_worker.py`
- Worker de background: `backend/scripts/background_task_worker.py`
- Observabilidad externa: Prometheus/Grafana en `https://console.edumind.es`

## Seguridad (producción)

- Autenticación por cookie `HttpOnly` + cabecera CSRF (`X-CSRF-Token`).
- Soporte SSO preparado para Authentik en `auth.edumind.es`.
- Variables recomendadas en `.env`:
  - `DEBUG=False`
  - `SECRET_KEY=<min 32 chars>`
  - `APP_BASE_URL=https://miapp.edumind.es`
  - `SESSION_COOKIE_SECURE=True`
  - `SESSION_COOKIE_SAMESITE=lax` (o `none` si frontend/backend están en dominios distintos, siempre con HTTPS)
  - `SESSION_COOKIE_DOMAIN=<opcional>`
  - `BACKEND_CORS_ORIGINS=["https://miapp.edumind.es"]` (si aplica CORS)
  - `AUTH_MODE=local|authentik`
  - `AUTHENTIK_ISSUER_URL=https://auth.edumind.es/application/o/<provider-slug>/`
  - `AUTHENTIK_CLIENT_ID=<client-id>`
  - `AUTHENTIK_CLIENT_SECRET=<client-secret>`

## Licencia

GNU GPL v3 - EDUmind / Los Mundos Edufis
