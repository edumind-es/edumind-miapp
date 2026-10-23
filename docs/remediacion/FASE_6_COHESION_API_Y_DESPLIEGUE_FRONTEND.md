# FASE 6 | Cohesión API y despliegue frontend

Fecha de ejecución: `2026-04-05`

## Objetivo

Dejar un único comportamiento funcional entre local, staging y producción para autenticación, consumo de API y despliegue SPA, incorporando además soporte real para `Authentik` en `auth.edumind.es` como mecanismo SSO principal cuando se active en configuración.

## Entregado

- resolución única de base API en frontend mediante `frontend/src/lib/api-base.ts`
- alineación de `axios`, `authFetch` y fetch de sesión sobre la misma base relativa o configurada por `VITE_API_URL`
- eliminación de rutas hardcodeadas `/api/v1/...` en flujos `fetch` del frontend
- `ProtectedRoute` con redirección consistente a `/login?next=...`
- nueva pantalla de acceso unificada en `frontend/src/pages/admin/AdminLogin.tsx`:
  - soporta modo local
  - soporta modo SSO
  - conserva alias `/admin/login`
  - sirve también como entrada para `teacher_premium`
- backend de autenticación ampliado con:
  - `GET /api/v1/auth/config`
  - `GET /api/v1/auth/sso/login`
  - `GET /api/v1/auth/sso/callback`
  - `POST /api/v1/auth/logout` con `logout_url` opcional para SSO
- soporte de provisión y enlace de identidad SSO en usuario:
  - `user.auth_provider`
  - `user.oidc_subject`
- migración Alembic `20260405_0004_authentik_sso_identity.py`
- `frontend/Dockerfile` alineado con `VITE_API_URL` de build
- `frontend/nginx.conf` con fallback SPA en contenedor
- configuración preparada en `.env` para activación posterior de Authentik

## Configuración SSO prevista

La activación productiva queda preparada mediante:

- `AUTH_MODE=authentik`
- `APP_BASE_URL=https://miapp.edumind.es`
- `AUTHENTIK_ISSUER_URL=https://auth.edumind.es/application/o/<provider-slug>/`
- `AUTHENTIK_CLIENT_ID=<client-id>`
- `AUTHENTIK_CLIENT_SECRET=<client-secret>`
- `AUTHENTIK_ROLE_CLAIM=groups`
- `AUTHENTIK_ADMIN_MATCHES=edumind-admin`
- `AUTHENTIK_TEACHER_PREMIUM_MATCHES=edumind-teacher-premium`

Mientras no se configure `issuer/client/secret`, la instancia puede seguir operando con `AUTH_MODE=local`.

## Verificación

- `backend`: `107 passed`
- `frontend`: `npm run lint` OK
- `frontend`: `npm run build` OK
- `auth`: `15 passed` específicos en `tests/test_auth.py`
- script repetible: `scripts/phase6_verify.sh`

## Riesgos abiertos

- la activación real de Authentik depende de disponer del `provider-slug`, `client_id` y `client_secret` definitivos
- el chunk `webllm` sigue siendo muy grande y mantiene un riesgo UX/performance ya identificado para fases posteriores
