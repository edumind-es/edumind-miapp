# Plan 0-10

La hoja de ruta correcta es: primero estabilizar y cerrar riesgos reales, luego escalar, y solo después acelerar nuevas funciones. No recomiendo abrir features nuevas de producto hasta cerrar al menos las fases `0` a `4`.

## Estado actual

- `2026-04-05`: FASE 0 cerrada
- `2026-04-05`: FASE 1 ejecutada y validada en runtime
- `2026-04-05`: FASE 2 ejecutada y validada con Redis activo
- `2026-04-05`: FASE 3 ejecutada y validada con tests de dominio docente
- `2026-04-05`: FASE 4 ejecutada con PostgreSQL + Alembic activo
- `2026-04-05`: FASE 5 ejecutada con cola persistente y worker activo
- `2026-04-05`: FASE 6 ejecutada con cohesión API/frontend y SSO Authentik activo en runtime
- `2026-04-05`: FASE 7 ejecutada con mejoras UX/UI de fiabilidad y presentación de contenido
- `2026-04-09`: auditoria completa de FASES `0` a `7` rehecha, corregida y verificada en runtime interno
- `2026-04-09`: FASE 8 ejecutada con validación previa por herramienta, salida estructurada validada y renderizado semántico de contenido
- `2026-04-09`: FASE 8 cerrada al 100% con `render/{tool}` seguro y sin exposición de `prompt_text`
- `2026-04-09`: FASE 9 ejecutada con health segmentado, telemetría normalizada y synthetic checks
- `2026-04-09`: edge publico confirmado en mantenimiento controlado; cutover publico pendiente
- `2026-04-09`: FASE 10 ejecutada con pipeline de despliegue seguro, cutover/rollback explícitos, restore validable y CI base
- entregables activos:
  - `.gitignore` raiz y limpieza controlada de artefactos runtime/build en el arbol
  - `scripts/phase0_capture_baseline.sh`
  - `scripts/phase0_verify.sh`
  - `scripts/phase1_verify.sh`
  - `scripts/phase2_verify.sh`
  - `scripts/phase3_verify.sh`
  - `scripts/phase4_verify.sh`
  - `scripts/phase5_verify.sh`
  - `scripts/phase6_verify.sh`
  - `scripts/phase7_verify.sh`
  - `scripts/phase8_verify.sh`
  - `scripts/phase9_verify.sh`
  - `scripts/phase10_verify.sh`
  - `scripts/synthetic_edge_checks.sh`
  - `scripts/preflight_release.sh`
  - `scripts/reload_runtime_services.sh`
  - `scripts/post_deploy_smoke.sh`
  - `scripts/cutover_activate_public.sh`
  - `scripts/cutover_enable_maintenance.sh`
  - `scripts/verify_webllm_split.sh`
  - `scripts/load_smoke_local.sh`
  - `docs/remediacion/FASE_0_BASELINE_Y_CONTROL.md`
  - `docs/remediacion/FASE_1_HARDENING_SEGURIDAD.md`
  - `docs/remediacion/FASE_2_CONCURRENCIA_Y_ADMISION.md`
  - `docs/remediacion/FASE_3_INTEGRIDAD_DE_DOMINIO.md`
  - `docs/remediacion/FASE_4_PERSISTENCIA_SERIA.md`
  - `docs/remediacion/FASE_5_ADELGAZAMIENTO_REQUEST_PATH.md`
  - `docs/remediacion/FASE_6_COHESION_API_Y_DESPLIEGUE_FRONTEND.md`
  - `docs/remediacion/FASE_7_UX_UI_DE_FIABILIDAD.md`
  - `docs/remediacion/FASE_8_GOBERNANZA_CONTENIDO_Y_CAPA_ANTI_ALUCINACION.md`
  - `docs/remediacion/FASE_9_OBSERVABILIDAD_OPERATIVA.md`
  - `docs/remediacion/FASE_10_ESCALABILIDAD_Y_ENTREGA_CONTINUA.md`
  - `docs/remediacion/CHECKLIST_CUTOVER_PUBLICO.md`
  - `docs/remediacion/AUDITORIA_TECNICA_FASES_0_A_7_2026-04-09.md`
  - `docs/remediacion/ARQUITECTURA_EDUMIND_MIAPP.md`
  - `docs/remediacion/baselines/2026-04-05_baseline_inicial.md`
  - `.github/workflows/ci.yml`

## Fases

### Fase 0 | Baseline y control del cambio

Objetivo:
congelar alcance, publicar una snapshot tecnica inicial, dejar verificacion repetible y reducir ruido del repositorio.

Entregado en esta fase:

- snapshot inicial con servicios, health, runtime policy y pesos base
- scripts de captura y verificacion
- mapa resumido de arquitectura
- control de artefactos locales con `.gitignore`
- limpieza controlada del arbol:
  - caches Python y `dist` generados fuera del versionado
  - `edumind.db` y `backend/edumind.db` marcados como runtime local
  - `backend/.venv` y bytecode eliminados del indice git para no contaminar cambios funcionales

Cierre esperado:

- staging reproducible
- rollback probado
- KPIs base publicados

### Fase 1 | Hardening de seguridad

Cerrar endpoints internos publicos, limitar observabilidad y `runtime-policy` a admin/VPN, ocultar rutas y paths sensibles, revisar CSP/cookies/CORS y anadir proteccion real de rutas en frontend.

Cierre:
ningun endpoint de topologia, capacidad o contenido interno queda expuesto anonimamente.

Entregado en esta fase:

- endpoints internos protegidos con `require_admin_or_vpn`
- resolucion de IP real detras de proxy fiable
- `ProtectedRoute` y sesion bootstrap en frontend para `admin` y `teacher_premium`
- eliminacion del fallback frontend a `http://localhost:8000/api/v1`
- verificacion automatizada de endpoints protegidos con `scripts/phase1_verify.sh`
- validacion runtime real contra `https://miapp.edumind.es`

### Fase 2 | Concurrencia y admision distribuidas

Rehacer cola y rate limiting sobre Redis con operaciones atomicas, mover la reserva de slot despues de auth/BYOK, unificar cooldowns y abuso en estado compartido, y definir semantica correcta para multi-worker.

Cierre:
el limite concurrente se cumple de forma determinista con varios procesos.

Entregado en esta fase:

- reserva de slot movida despues de auth/BYOK/restricciones en `chat` y `generators`
- `queue_manager` endurecido con reserva consistente por lock compartido y backend Redis
- `admission_control_service` con cuotas, cooldowns y abuso compartidos via Redis cuando esta disponible
- `backend/.env` activado con `REDIS_URL`, `QUEUE_BACKEND=redis` y `ADMISSION_BACKEND=redis`
- servicio real reiniciado con Redis activo
- tests de regresion nuevos para:
  - no consumir slot en respuestas `402` o `403`
  - coherencia compartida de cola y cuota anonima entre instancias

### Fase 3 | Integridad de dominio

Anadir validacion fuerte server-side en `classroom`, `planner` y `resources`, validar ownership de `resource_id`, limites de `student_count`, horarios validos, formatos y estados; envolver altas/actualizaciones criticas en transacciones atomicas.

Cierre:
no hay commits parciales ni referencias cruzadas no autorizadas.

Entregado en esta fase:

- validacion fuerte de entrada en `schemas_classroom.py`
- creacion de clases atomica y sincronizacion segura de `StudentCode`
- bloqueo de reducciones de alumnado que destruirian notas existentes
- deteccion de solapes de horario por clase y dia
- ownership real de `resource_id` en planner
- guardado atomico de recursos con link opcional a clase
- tests nuevos de dominio `teacher_premium` para classroom/planner/resources

### Fase 4 | Persistencia seria

Migrar produccion a PostgreSQL, activar modo Alembic-only, desactivar `create_all` y SQLite en prod, definir indices y constraints reales, y revisar pooling/conexiones.

Cierre:
despliegue con migraciones versionadas y rollback seguro de esquema.

Entregado en esta fase:

- PostgreSQL dedicado para `edumind_miapp` en `127.0.0.1:5435`
- `.env` de backend migrado a `postgresql+psycopg`
- validacion fuerte de configuracion para obligar PostgreSQL en `staging` y `production`
- `create_all` limitado a SQLite de desarrollo
- migraciones operables via `backend/scripts/run_migrations.py`
- indices y constraints reales en `20260405_0002_persistence_hardening.py`
- copia de datos desde SQLite a PostgreSQL completada
- `deploy.sh` y `backup_db.sh` adaptados al nuevo backend

### Fase 5 | Adelgazamiento del request path

Sacar del proceso web el parsing pesado de documentos, push de alertas, comprobaciones lentas y tareas costosas; moverlo a workers/cola y rodearlo de timeouts, retries y circuit breakers.

Cierre:
el proceso HTTP solo sirve trafico interactivo y el `p95` baja de forma medible.

Entregado en esta fase:

- cola persistente `BackgroundTaskJob` en PostgreSQL
- worker dedicado para tareas de background
- `dataset/upload` sin parseo inline
- push de alertas desacoplado del request path
- reintentos con backoff y timeout por tipo de tarea
- circuit breaker para webhook de alertas
- `health` sin comprobacion bloqueante de Ollama
- servicio `systemd --user` activo para el background worker

### Fase 6 | Cohesion API y despliegue frontend

Unificar cliente HTTP, eliminar fallback a `localhost`, alinear Docker/Nginx/SPA fallback, consolidar bootstrap de sesion con `/auth/me` y crear `ProtectedRoute` real para admin y teacher premium.

Cierre:
mismo comportamiento en local, staging y produccion.

Entregado en esta fase:

- resolucion unica de base API en frontend para `axios` y `authFetch`
- eliminacion de rutas hardcodeadas `/api/v1/...` en flujos `fetch`
- redireccion consistente a `/login?next=...` para rutas protegidas
- pantalla de acceso unificada para admin y `teacher_premium`
- soporte backend para `Authentik` con `auth/config`, `auth/sso/login` y `auth/sso/callback`
- persistencia de identidad SSO en usuario con `auth_provider` y `oidc_subject`
- `frontend/Dockerfile` y `frontend/nginx.conf` alineados con fallback SPA
- verificacion repetible con `scripts/phase6_verify.sh`

### Fase 7 | UX/UI de fiabilidad

Impedir cambios silenciosos de motor, mejorar estados de carga/error, sustituir `alert/confirm` por UI consistente, abortar generaciones al desmontar, corregir impresion segura y limpiar mensajes obsoletos.

Cierre:
la UX deja de sorprender, bloquear o degradarse en flujos largos.

Entregado en esta fase:

- `Authentik` activado en runtime como SSO unico para `miapp`
- recomendacion de motor presentada como sugerencia explicita, sin cambio automatico silencioso
- renderizado legible de contenido generado y respuestas de chat
- separacion entre vista previa y edicion en generadores
- eliminacion de `alert/confirm` nativos en frontend
- avisos inline consistentes para acciones de usuario
- abort de generaciones garantizado al desmontar
- impresion de listados docente saneada
- mensajes de carga alineados con el stack actual

### Fase 8 | Capa de conocimiento y normativa

Objetivo:
hacer que la capa de contenido y la salida de IA sean trazables, publicables y resistentes a alucinacion.

Entregado en esta fase:

- cache indexada para normativa
- proteccion de `knowledge/document` y, tras la auditoria del `2026-04-09`, de `knowledge/categories`, `knowledge/documents` y `knowledge/search`
- validacion previa por herramienta para bloquear payloads incompletos o placeholders
- contratos JSON por defecto en herramientas de mayor riesgo
- validacion server-side de salida estructurada antes de publicarla
- renderizado semantico de contenido estructurado en frontend
- limpieza de residuos de proveedor en flujos estructurados
- rediseno seguro de `generators/render/{tool}` sin exponer `prompt_text` al cliente
- verificacion repetible con `scripts/phase8_verify.sh`

Trabajo residual de la fase:

- separar corpus `publico`, `privado` y `admin` con ACL explicitas
- exigir citas mas estrictas y trazabilidad documental expandida para normativa

Cierre:
la app solo muestra contenido publicable, con contratos de salida claros y sin filtraciones de prompting interno.

### Fase 9 | Observabilidad operativa

Objetivo:
operar la app con datos reales de salud, seguridad y experiencia de usuario.

Entregado en esta fase:

- metricas Prometheus-friendly con labels normalizados y control de cardinalidad
- normalizacion de telemetria de rutas invalidas y referrers
- health publico, health de dependencias y health interno separados
- redaccion de PII operativa mediante IPs enmascaradas en panel admin
- synthetic checks repetibles para `miapp.edumind.es` y `app.edumind.es`
- verificacion automatizada con `scripts/phase9_verify.sh`

Trabajo residual de la fase:

- conexion de scrape real desde Prometheus/Grafana externo si se desea historico persistente
- dashboards visuales dedicados para cola, SSO, workers y dominios funcionales
- alerting externo por correo/webhook desde plataforma de observabilidad completa

Cierre:
podemos detectar degradacion, explicar su causa y decidir apertura/cierre de mantenimiento con datos operativos.

### Fase 10 | Escalabilidad y entrega continua

Objetivo:
salir de mantenimiento con un cutover seguro, reproducible y escalable.

Redisenyo de esta fase:

- checklist de cutover publico para `miapp.edumind.es` y `app.edumind.es`
- separacion real del bundle `webllm` para no penalizar la carga base
- pipeline CI/CD con lint, tests, smoke post-deploy, migraciones y rollback
- pruebas de carga de API, Redis, Postgres y workers
- validacion de backup/restore
- topologia objetivo estable:
  - frontend estatico
  - api
  - background worker
  - redis
  - postgres
  - authentik

Cierre:
la app queda preparada para apertura publica y crecimiento de usuarios sin improvisacion operativa.

Entregado en esta fase:

- `deploy.sh` endurecido con `preflight`, backup, migraciones, reload y smoke
- `deploy_pro.sh` con cutover explicito opcional mediante `--activate-public`
- scripts de operacion para apertura y rollback del edge:
  - `scripts/cutover_activate_public.sh`
  - `scripts/cutover_enable_maintenance.sh`
- verificacion automatizada de la separacion del bundle `webllm`
- smoke de carga local para API, Redis, Postgres y workers
- `restore_db.sh` con `dry-run` y restauracion controlada por `--force`
- workflow base de CI en GitHub Actions para backend, frontend y migraciones
- checklist operativo de cutover y rollback documentado

Trabajo residual de la fase:

- integrar despliegue automatico real desde CI a entorno productivo si se desea CD completa
- ampliar pruebas de carga con escenarios funcionales de generacion real y colas
- abrir el edge publico cuando producto y negocio den luz verde

## Reglas de ejecucion

- un PR por fase o subfase critica, sin mezclar migracion de datos con cambios UI
- cada fase debe cerrar con pruebas automaticas, checklist de seguridad y criterio de rollback
- las fases `1`, `2`, `3` y `4` son bloqueantes antes de hablar de escalado real
- las fases `7` y `8` pueden solaparse parcialmente una vez cerradas `5` y `6`
- la fase `9` empieza a sembrarse en `0`, pero se consolida de verdad al final

## Orden recomendado de trabajo

- primera ola: fases `0` a `3`
- segunda ola: fases `4` a `6`
- tercera ola: fases `7` a `10`
