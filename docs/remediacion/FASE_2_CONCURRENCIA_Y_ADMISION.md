# FASE 2 - Concurrencia y admision distribuidas

## Objetivo

Hacer que el control de capacidad sea coherente y operativo con varios procesos:

- evitar consumo fantasma de slots en peticiones rechazadas
- compartir cola y cuotas anonimas entre workers
- aprovechar Redis ya disponible en el servidor
- dejar validacion repetible de la fase

## Cambios implementados

### Reserva de slots en el punto correcto

- `chat` y `generators` ya no reservan cola antes de:
  - validar acceso restringido
  - resolver BYOK
  - rechazar `402` o `403`
- esto elimina la fuga de capacidad causada por peticiones invalidadas tarde

### Cola distribuida

- `app/core/queue_manager.py` usa Redis compartido cuando esta disponible
- la reserva en Redis se ejecuta bajo lock compartido para mantener decision consistente entre procesos
- el fallback en memoria tambien se rehizo para no separar limpieza, conteo y reserva en locks distintos

### Admision distribuida

- `app/services/admission_control_service.py` ya no depende solo de estado local
- cuotas anonimas, cooldowns y contador de abuso usan Redis cuando esta disponible
- se activaron:
  - `REDIS_URL=redis://127.0.0.1:6379/0`
  - `QUEUE_BACKEND=redis`
  - `ADMISSION_BACKEND=redis`

### Validacion automatizada

- nuevos tests de regresion:
  - peticiones `402` y `403` no consumen slot
  - dos instancias distintas comparten cola y cuota anonima
- nuevo script:
  - `scripts/phase2_verify.sh`

## Verificacion realizada el 2026-04-05

- `scripts/phase0_verify.sh`: OK
  - backend: `90 passed`
  - frontend lint: OK
  - frontend build: OK
- backend real reiniciado sobre el codigo de FASE 2
- `GET http://127.0.0.1:8100/api/v1/queue/status` devuelve `backend=redis`
- Redis local responde `PONG`

## Riesgos mitigados

- slots ocupados por peticiones sin BYOK o sin permisos
- contadores de admision inconsistentes entre workers
- carga compartida no visible en despliegue multi-proceso

## Riesgos que siguen para fases posteriores

- persistencia principal sigue en SQLite
- parsing y tareas pesadas siguen en el request path
- la cola actual sigue modelada como sesion activa por TTL, no como lease por request
