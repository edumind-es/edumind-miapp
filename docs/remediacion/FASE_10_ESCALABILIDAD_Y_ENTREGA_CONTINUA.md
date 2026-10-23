# FASE 10 | Escalabilidad y entrega continua

Fecha de cierre inicial: `2026-04-09`

## Objetivo

Salir de mantenimiento con un proceso de release seguro, repetible y reversible, sin improvisar apertura pública ni operación diaria.

## Cambios ejecutados

- endurecimiento del flujo de despliegue en `deploy.sh`
  - `preflight` previo
  - backup de base de datos antes de migrar
  - build frontend y migraciones
  - recarga de runtime desacoplada de `sudo` interactivo
  - smoke post-deploy
- despliegue productivo con opción de cutover explícito en `deploy_pro.sh`
  - por defecto despliega manteniendo `miapp.edumind.es` en mantenimiento
  - con `--activate-public` ejecuta apertura pública y smoke de live
- automatización operativa nueva en `scripts/`
  - `preflight_release.sh`
  - `reload_runtime_services.sh`
  - `post_deploy_smoke.sh`
  - `cutover_activate_public.sh`
  - `cutover_enable_maintenance.sh`
  - `verify_webllm_split.sh`
  - `load_smoke_local.sh`
  - `phase10_verify.sh`
- restauración validable de base de datos en `backend/scripts/restore_db.sh`
  - soporte `dry-run`
  - soporte PostgreSQL y SQLite según backend configurado
- CI básico en `.github/workflows/ci.yml`
  - lint y build frontend
  - tests backend con SQLite efímera
  - migraciones a `head` en entorno reproducible

## Cutover público

Checklist operativo:

- ejecutar `./scripts/phase10_verify.sh`
- ejecutar `./deploy.sh`
- validar `./scripts/post_deploy_smoke.sh --public-mode maintenance`
- abrir público con `./scripts/cutover_activate_public.sh`
- validar `./scripts/post_deploy_smoke.sh --public-mode live`
- vigilar señales en `console.edumind.es`
- si algo falla, volver a mantenimiento con `./scripts/cutover_enable_maintenance.sh`

## Verificación

- `scripts/phase10_verify.sh`
- `scripts/phase9_verify.sh`
- `scripts/preflight_release.sh`
- `scripts/verify_webllm_split.sh`
- `scripts/load_smoke_local.sh`
- `scripts/post_deploy_smoke.sh --public-mode maintenance`

## Resultado operativo

- el despliegue deja de depender de pasos manuales implícitos
- el edge público puede abrirse o cerrarse con criterio y rollback claro
- `webllm` queda comprobado como chunk separado para no penalizar la shell base
- backup y restore ya forman parte del diseño operativo, no solo de la documentación
- la integración con Prometheus/Grafana ya puede apoyarse en `https://console.edumind.es` como consola de observación externa

## Nota

La fase deja la app lista para apertura pública controlada, pero no fuerza el cutover. La decisión de salir de mantenimiento sigue siendo operativa.
