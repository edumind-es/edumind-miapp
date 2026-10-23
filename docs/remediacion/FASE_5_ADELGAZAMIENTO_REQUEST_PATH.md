# FASE 5 | Adelgazamiento del request path

Estado: ejecutada el `2026-04-05`

## Objetivo

Sacar del proceso web las tareas pesadas o lentas que no deben vivir en el request interactivo y dejar una cola persistente con worker, reintentos y protecciones operativas.

## Cambios aplicados

- nueva cola persistente en BD con `BackgroundTaskJob`
- nuevo worker en `backend/scripts/background_task_worker.py`
- nuevo ejecutor aislado por job en `backend/scripts/process_background_job.py`
- nuevo servicio `background_task_queue_service.py` para:
  - encolar parseo de documentos
  - encolar push de alertas de proveedores
  - reclamar jobs pendientes
  - reintentar con backoff exponencial
  - ejecutar con timeout por tipo de tarea
- `dataset/upload` ya no parsea inline:
  - guarda el documento
  - marca `processing_status=queued`
  - encola `document_parse`
- `generators` ya no hace push webhook inline:
  - construye alertas
  - encola `provider_alert_push`
- `provider_alert_push_service.py` endurecido:
  - timeout configurable
  - cooldown compartido con Redis cuando esta disponible
  - circuit breaker para fallos repetidos del webhook
- `health.py` deja de usar `httpx.get` bloqueante para comprobar Ollama

## Persistencia nueva

Migracion aplicada:

- `20260405_0003_background_tasks.py`

Incluye:

- tabla `backgroundtaskjob`
- indices de cola sobre `task_type`, `status`, `dedupe_key`, `available_at` y `created_at`
- columnas nuevas en `document`:
  - `processing_status`
  - `processing_started_at`
  - `processed_at`
  - `parse_error`

## Runtime activado

- servicio usuario activo: `edumind-miapp-background-worker.service`
- API reiniciada con la revision runtime `20260405_0003`
- smoke real validado:
  - job `document_parse` creado en PostgreSQL
  - worker lo procesa
  - documento pasa a `completed`
  - se crea `1` `TrainingItem`

## Verificacion

- `./scripts/phase5_verify.sh`
- backend total: `104 passed`
- worker activo en `systemd --user`
- migraciones validadas con:
  - rollback de FASE 4 hasta `20260405_0002`
  - lifecycle completo hasta `head`

## Riesgo cerrado

- el upload de documentos ya no bloquea el proceso HTTP con parsing pesado
- el push de alertas ya no introduce latencia ni fallos del webhook en la respuesta al usuario
- la app gana una base reutilizable para sacar futuras tareas costosas fuera del request path
