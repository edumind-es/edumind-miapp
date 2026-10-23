# Baseline inicial - 2026-04-05

## Contexto de captura

- Fecha UTC: `2026-04-05T08:52:13Z`
- Host: `mail.losmundosedufis.com`
- Repo: `/var/www/edumind_miapp`
- Rama: `main`
- Commit: `ac186ac8`

## Estado operativo observado

### Servicios activos

```text
edumind-miapp-training-worker.service loaded active running EDUMind MiApp Training Worker (User Service)
edumind-miapp.service                 loaded active running EDUMind MiApp backend
ollama-gemma.service                  loaded active running Ollama Gemma 4 local service
```

### Health backend

```json
{"status":"healthy","timestamp":"2026-04-05T08:51:44.440293","version":"1.0.0","checks":{"database":{"status":"healthy","message":"Database connected"},"knowledge_base":{"status":"healthy","message":"Knowledge base OK (4 documents)"},"ollama":{"status":"healthy","message":"Ollama running"},"disk_space":{"status":"healthy","message":"314.2 GB free (61.2% used)"}}}
```

### Runtime policy

```json
{"managed_public_enabled":true,"load_shed_enabled":true,"load_shed_queue_utilization":0.9,"load_shed_min_active":4,"anon_window_seconds":900,"anon_max_requests":20,"anon_cooldown_seconds":600,"anon_max_input_chars":8000,"abuse_window_seconds":600,"abuse_challenge_threshold":5,"queue_active_sessions":0,"queue_max_concurrent_users":5,"queue_utilization":0.0,"provider_reliability":{},"provider_guard_overrides":{},"recommended_engine":"edumind"}
```

## Inventario redaccionado de variables

### `.env`

```text
ACCESS_TOKEN_EXPIRE_MINUTES
DATABASE_URL
DEBUG
EDUMIND_CORE_TOKEN
EDUMIND_CORE_URL
MATOMO_BASE_URL
MATOMO_SITE_ID
OLLAMA_DEFAULT_MODEL
OLLAMA_GENERATE_URL
OLLAMA_URL
SECRET_KEY
```

### `backend/.env`

```text
ACCESS_TOKEN_EXPIRE_MINUTES
DATABASE_URL
DEBUG
EDUMIND_CORE_TOKEN
EDUMIND_CORE_URL
OLLAMA_DEFAULT_MODEL
OLLAMA_GENERATE_URL
OLLAMA_URL
SECRET_KEY
```

## Verificacion tecnica base

### Backend

```text
82 passed in 1.67s
```

Comando usado:

```bash
cd /var/www/edumind_miapp/backend
env -u DEBUG PYTHONPATH=. SECRET_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa .venv/bin/pytest -q
```

### Frontend

```text
npm run lint   -> OK
npm run build  -> OK
```

### Peso de build actual

```text
dist total: 7.5M
5511625 dist/assets/webllm-Crp3my30.js
224612 dist/assets/react-vendor-BtkC1Bgh.js
104041 dist/assets/vendor-CGl9z-CC.js
77805 dist/assets/motion-LPUJhqWX.js
68613 dist/assets/index-Cw4dlCJi.css
```

Observacion:

- `webllm` domina claramente la carga inicial y debe tratarse como objetivo de optimizacion en fases posteriores.

## Huella de almacenamiento local observada

```text
714M .venv
4.0K uploads
48K dataset
48K knowledge
8.0K modelos_lora
```

## Notas de control del cambio

- El repositorio estaba muy contaminado por caches, builds y artefactos locales; la FASE 0 arranca corrigiendo esto con un `.gitignore` raiz.
- Esta snapshot sirve como punto de comparacion antes de entrar en fases de seguridad, concurrencia y persistencia.
