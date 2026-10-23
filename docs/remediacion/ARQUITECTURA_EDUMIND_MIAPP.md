# Arquitectura actual de `edumind_miapp`

## Vista general

`edumind_miapp` es hoy un monolito modular:

- `frontend/`: React + Vite, servido como SPA
- `backend/`: FastAPI con modulos por dominio
- `backend/scripts/training_worker.py`: worker separado para jobs largos de entrenamiento
- `Ollama local`: servicio de inferencia local para Gemma 4

En produccion, la entrada prevista es Nginx con dos responsabilidades:

- servir `frontend/dist`
- hacer proxy de `/api/v1/*` hacia el backend

## Capas actuales

### 1. Edge y entrega

- Nginx definido en [nginx_production.conf](/var/www/edumind_miapp/nginx_production.conf)
- dominio canonico y redirecciones en [app.edumind.es.conf](/var/www/edumind_miapp/deploy/app.edumind.es.conf)

### 2. Frontend

El frontend se organiza alrededor de:

- `App.tsx`: routing principal
- `src/pages/`: herramientas, admin, chat, classroom y planner
- `src/lib/`: clientes HTTP, auth, servicios funcionales y WebLLM
- `src/layouts/`: shells de admin y generadores

Hay tres familias de flujo:

- generacion IA
- administracion y entrenamiento
- teacher premium: clases, recursos y planner

### 3. Backend

El backend expone la API en [api.py](/var/www/edumind_miapp/backend/app/api/v1/api.py).

Dominios principales:

- `auth`, `admin`, `training`, `dataset`
- `chat`, `generators`, `config`, `health`
- `knowledge`, `normative`, `telemetry`
- `classroom`, `planner`, `resources`

Servicios de soporte destacados:

- `ai_service.py`: orquestacion de proveedores IA
- `queue_manager.py`: proteccion de concurrencia
- `admission_control_service.py`: control de admision
- `metrics_service.py`: metricas internas en memoria
- `training_queue_service.py`: cola persistente de entrenamiento

### 4. Datos y estado

Estado actual observado:

- base principal con SQLite por defecto
- conocimiento local en `backend/knowledge/`
- uploads y dataset en `backend/uploads/` y `backend/dataset/`
- versiones/modelos en `backend/modelos_lora/`
- backups SQLite en `backend/backups/`

### 5. Servicios activos observados el 2026-04-05

- `edumind-miapp.service`
- `edumind-miapp-training-worker.service`
- `ollama-gemma.service`

## Riesgos estructurales ya detectados

- demasiadas responsabilidades en el proceso HTTP
- estado en memoria en piezas que deberian ser distribuidas
- mezcla de configuracion de desarrollo y operacion de produccion
- capa frontend con clientes y rutas no del todo unificados

## Topologia objetivo para fases posteriores

La evolucion natural de esta arquitectura es:

1. `frontend` estatico
2. `api` FastAPI
3. `worker` para tareas largas/no interactivas
4. `redis` para cola, admision y cache compartida
5. `postgres` para persistencia principal
6. `ollama` como inferencia local desacoplada

Ese es el marco sobre el que se apoyan las fases 1 a 10 del plan de remediacion.
