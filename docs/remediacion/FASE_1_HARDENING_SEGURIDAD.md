# FASE 1 - Hardening de seguridad

## Objetivo

Reducir superficie expuesta sin romper la operativa principal:

- cerrar endpoints internos para trafico anonimo
- proteger rutas de gestion en frontend
- alinear resolucion de IP real con el proxy inverso
- dejar una verificacion repetible en tests y en runtime real

## Cambios implementados

### Backend

- `require_admin_or_vpn` aplicado a:
  - `GET /api/v1/health/providers`
  - `GET /api/v1/metrics`
  - `GET /api/v1/health/slo`
  - `GET /api/v1/metrics/prometheus`
  - `GET /api/v1/config/runtime-policy`
  - `GET /api/v1/knowledge/document/{category}/{name}`
  - `GET /api/v1/normative/status`
- resolucion de IP cliente endurecida en `app/core/security.py`
  - usa `CF-Connecting-IP`, `X-Real-IP` y `X-Forwarded-For` solo cuando el peer inmediato es un proxy fiable
- cobertura de tests ampliada para auth y endpoints protegidos

### Frontend

- eliminacion del fallback absoluto a `http://localhost:8000/api/v1`
- bootstrap de sesion con `GET /api/v1/auth/me`
- `AuthSessionProvider` para hidratar rol y estado real de sesion
- `ProtectedRoute` aplicado a:
  - rutas `admin`
  - rutas `classroom`
  - rutas `planner`
- `AdminLayout` y `AdminLogin` desacoplados de `localStorage.admin_user` como fuente principal de autorizacion

### Infra y despliegue

- identificacion del servicio real de produccion:
  - `systemd` del sistema: `edumind-miapp.service`
- retirada del servicio duplicado `systemd --user` del flujo de arranque
- endurecimiento mantenido en `nginx_production.conf` con CSP y cabeceras seguras del repo

## Verificacion ejecutable

### 1. Checks de codigo

```bash
cd /var/www/edumind_miapp
scripts/phase0_verify.sh
```

### 2. Checks de seguridad de FASE 1

```bash
cd /var/www/edumind_miapp
scripts/phase1_verify.sh
```

El script valida:

- acceso local permitido desde loopback
- denegacion `403` para acceso simulado externo por proxy fiable
- denegacion `403` en la URL publica si `PHASE1_PUBLIC_BASE_URL` esta configurada

## Validacion realizada el 2026-04-05

- `scripts/phase0_verify.sh`: OK
- `scripts/phase1_verify.sh`: OK
- verificacion manual:
  - `http://127.0.0.1:8100/api/v1/config/runtime-policy` devuelve `200` desde loopback
  - `curl -H 'X-Real-IP: 8.8.8.8' .../runtime-policy` devuelve `403`
  - `https://miapp.edumind.es/api/v1/config/runtime-policy` devuelve `403`
  - `https://miapp.edumind.es/api/v1/health/providers` devuelve `403`

## Riesgos que ya no quedan abiertos

- fuga anonima de topologia y capacidad por observabilidad interna
- acceso publico directo a contenido interno de conocimiento
- proteccion de rutas frontend basada solo en `localStorage`
- dependencia del frontend en un backend `localhost` fuera de entorno local

## Pendiente para fases siguientes

- control de concurrencia distribuido y atomico
- validacion fuerte y transacciones de dominio
- migracion a PostgreSQL y despliegue mas robusto
