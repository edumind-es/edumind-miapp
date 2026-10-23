# FASE 9 | Observabilidad operativa

Fecha de cierre inicial: `2026-04-09`

## Objetivo

Operar la app con señales útiles, estables y seguras: métricas con cardinalidad controlada, health segmentado por audiencia, telemetría normalizada y checks sintéticos repetibles para edge y backend.

## Cambios ejecutados

- endurecimiento de métricas en `backend/app/services/metrics_service.py`
  - normalización de endpoints, rutas inválidas, referrers y razones de admisión
  - límites de cardinalidad con bucket `__other__`
  - metadatos de overflow en `metrics.get_metrics()`
  - nueva serie Prometheus para referrers normalizados
- saneado de telemetría en `backend/app/api/v1/telemetry.py`
  - rutas inválidas normalizadas
  - referrer sin query sensible
  - clasificación de `user_agent` por familia en lugar de cadena completa
- mejora de panel admin en `backend/app/api/v1/admin.py`
  - IPs enmascaradas en eventos recientes y logs
  - navegación inválida con rutas/referrers normalizados
  - lectura de top runtime para paths y referrers
- separación de health en `backend/app/api/v1/health.py`
  - `GET /api/v1/health/public`
  - `GET /api/v1/health/dependencies`
  - `GET /api/v1/health/internal`
  - mantenimiento de compatibilidad con `GET /api/v1/health`
- verificación sintética reutilizable
  - `scripts/synthetic_edge_checks.sh`
  - `scripts/phase9_verify.sh`

## Verificación

- backend observability focalizado: `20 passed`
- `scripts/phase9_verify.sh`
- `scripts/phase6_verify.sh`
- `npm run lint` OK
- `npm run build` OK

## Resultado operativo

- el edge público y el backend interno se pueden comprobar con rutas diferenciadas según audiencia
- las métricas Prometheus salen con labels estables y aptos para scrape
- la telemetría de navegación deja de inflarse con URLs arbitrarias y reduce exposición de datos innecesarios
- el panel admin consume señales más limpias y con IP redacted

## Nota de despliegue

La fase deja la aplicación preparada para integración externa con Prometheus/Grafana u otra plataforma, pero no depende de haber desplegado esos componentes para ser útil desde hoy.
