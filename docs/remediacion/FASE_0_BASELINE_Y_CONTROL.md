# FASE 0 - Baseline y control del cambio

## Objetivo

Crear una base operativa comun antes de tocar seguridad, concurrencia o persistencia:

- publicar una snapshot inicial del estado real de la app
- dejar una verificacion repetible
- separar mejor codigo y artefactos runtime en el repositorio
- documentar arquitectura y servicios actuales para las fases 1 a 10

## Entregables implementados

- `.gitignore` raiz para reducir ruido de runtime y build
- `scripts/phase0_capture_baseline.sh`
- `scripts/phase0_verify.sh`
- `docs/remediacion/ARQUITECTURA_EDUMIND_MIAPP.md`
- `docs/remediacion/baselines/2026-04-05_baseline_inicial.md`
- limpieza controlada del arbol:
  - `frontend/dist` fuera del versionado tras verificacion
  - caches `__pycache__`, `*.pyc` y `.pytest_cache` fuera del control de cambios
  - `edumind.db`, `backend/edumind.db` y `backend/.venv` tratados como artefactos runtime locales

## Como usarlo

### 1. Verificacion tecnica base

```bash
cd /var/www/edumind_miapp
scripts/phase0_verify.sh
```

Esto valida:

- backend tests con entorno saneado
- lint del frontend
- build del frontend

### 2. Snapshot operativa del entorno

```bash
cd /var/www/edumind_miapp
scripts/phase0_capture_baseline.sh --default-output
```

La salida se genera en:

```text
docs/remediacion/baselines/generated/
```

El script publica en Markdown:

- rama y commit
- estado git resumido
- servicio real `systemd` del backend
- servicios de usuario relacionados con la app
- runtime de contenedores relacionados
- inventario redaccionado de variables de entorno
- health y runtime policy del backend
- revision de migraciones activa
- tamano del `dist` y activos mas pesados
- huella de almacenamiento del backend

## Criterio de cierre de FASE 0

- existe una snapshot inicial publicada y una forma automatizada de regenerarla
- los checks base se pueden ejecutar siempre igual
- el equipo tiene un mapa de arquitectura comun
- el repositorio deja de contaminarse con artefactos previsibles de build y cache

## Estado de cierre alcanzado el 2026-04-05

- `scripts/phase0_verify.sh` validado con backend, lint y build
- verificacion backend aislada con SQLite efimera para no tocar datos runtime
- arbol limpiado de artefactos generados previsibles
- servicio duplicado `systemd --user` identificado y retirado del flujo operativo
- servicio real de despliegue confirmado en `systemd` del sistema

## Lo que no cierra aun esta fase

- no corrige seguridad funcional ni concurrencia
- no migra la base de datos
- no cambia la topologia de despliegue

Eso queda reservado para las fases 1 a 4.
