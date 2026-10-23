# Auditoria Tecnica Fases 0-7

Fecha: `2026-04-09`

## Alcance

Revision completa de:

- codigo backend y frontend de `/var/www/edumind_miapp`
- despliegue actual en `miapp.edumind.es` y `app.edumind.es`
- coherencia real entre lo prometido en FASES `0` a `7` y lo que hoy esta corriendo
- seguridad de exposicion, aislamiento entre usuarios, presentacion de contenido y riesgo de mostrar artefactos internos de IA

## Verificacion ejecutada

Se ha reejecutado y saneado la verificacion acumulada:

- `./scripts/phase0_verify.sh`: `111 passed`, `npm run lint` OK, `npm run build` OK
- `./scripts/phase1_verify.sh`: OK tras recarga del servicio runtime
- `./scripts/phase6_verify.sh`: OK, incluye validacion acumulada `0` a `6`, migraciones SQLite efimeras, revision Alembic runtime `20260405_0004 (head)` y worker de background activo
- `./scripts/phase7_verify.sh`: OK, con chequeo adaptado al despliegue real en mantenimiento

Runtime validado:

- backend real en `127.0.0.1:8100`
- `app.edumind.es` redirige a `miapp.edumind.es`
- `miapp.edumind.es` sigue en mantenimiento publico con `maintenance.html`
- SSO Authentik activo en runtime local

## Hallazgos

### Alta | El despliegue publico sigue bloqueado por mantenimiento

La app esta operativa en backend y verificada hasta FASE 7, pero el edge publico sigue sirviendo mantenimiento. Eso significa que FASE 6 y FASE 7 estan cerradas a nivel de codigo y runtime interno, pero todavia no estan validadas en cutover real de usuario final.

Evidencias:

- `app.edumind.es` solo redirige a `miapp.edumind.es`
- `miapp.edumind.es` usa el sitio de mantenimiento del servidor
- `GET https://miapp.edumind.es/api/v1/auth/sso/login?next=/admin` devuelve `503` porque el mantenimiento bloquea `/api/`
- existe el archivo publico [`maintenance.html`](/var/www/edumind_miapp/maintenance.html)

Impacto:

- no existe todavia validacion E2E publica de SPA + callback SSO + navegacion protegida
- cualquier conclusion de UX publica queda condicionada por este modo mantenimiento

### Alta | `render/{tool}` sigue exponiendo prompts internos al cliente publico

El endpoint [`generators.py`](/var/www/edumind_miapp/backend/app/api/v1/generators.py) en `POST /api/v1/generators/render/{tool}` sigue devolviendo texto de prompt completo. Esto no filtra datos de otros usuarios, pero si expone contratos internos de prompting y aumenta la superficie de abuso o copia de logica interna. El consumidor actual es [`generator-service.ts`](/var/www/edumind_miapp/frontend/src/lib/generator-service.ts).

Impacto:

- fuga de know-how interno de prompting
- mas facilidad para prompt probing sobre herramientas de alto riesgo
- dependencia de backend para WebGPU local sin capa intermedia de tickets o cache firmado

Estado:

- no corregido en esta auditoria porque hoy alimenta el flujo WebGPU
- debe redisenarse en FASE 8

### Media | Los prompt builders siguen empujando al modelo a rellenar huecos con `No especificado`

Los builders de prompts en [`prompts.py`](/var/www/edumind_miapp/backend/app/core/prompts.py) siguen insertando valores como `No especificado` en campos clave (`curso`, `objetivo`, `criterios`, etc.). Esto no rompe seguridad, pero si incrementa presion a la alucinacion y baja la calidad del resultado cuando el formulario llega pobre o incompleto.

Impacto:

- respuestas largas pero de bajo valor
- mayor tendencia del modelo a completar con contenido generico
- experiencia opaca para el usuario, que puede pensar que la IA "entendio" datos no informados

Estado:

- detectado
- pendiente de redisenar con validacion previa por herramienta y contratos de campos obligatorios

### Media | El bundle WebLLM sigue siendo demasiado pesado para salida a produccion general

La build sigue generando `dist/assets/webllm-*.js` con un peso aproximado de `5.5 MB` minificado. Eso es demasiado costoso para la primera carga, especialmente en movil o conexiones lentas.

Evidencias:

- [`webllm-service.ts`](/var/www/edumind_miapp/frontend/src/lib/webllm-service.ts)
- [`WebLLMLoader.tsx`](/var/www/edumind_miapp/frontend/src/components/WebLLMLoader.tsx)
- warnings recurrentes en `npm run build`

Impacto:

- peor `LCP` y tiempo hasta interaccion
- penaliza la apertura publica de la app
- obliga a separar mejor flujos cloud vs local

### Media | El polling de diagnosticos protegidos generaba ruido constante para usuarios no privilegiados

[`EngineSelector.tsx`](/var/www/edumind_miapp/frontend/src/components/EngineSelector.tsx) consultaba `runtime-policy` y `health/providers` en bucle aunque el usuario no tuviera permisos para verlos. Eso no fugaba datos, pero producia `401/403` periodicos y ruido operativo.

Estado:

- corregido en esta auditoria
- ahora el componente deja de insistir cuando el backend responde `401/403`

### Media | El catalogo de conocimiento y snippets internos estaban expuestos por error

Antes de esta auditoria, [`knowledge.py`](/var/www/edumind_miapp/backend/app/api/v1/knowledge.py) permitia listar categorias, documentos y fragmentos de busqueda sin control admin/VPN. Eso si podia exponer contenido interno del corpus.

Estado:

- corregido en codigo y verificado en runtime
- ahora `categories`, `documents` y `search` devuelven `403` fuera de admin/VPN

### Media | El catalogo de contratos de prompt estaba expuesto sin proteccion

Antes de esta auditoria, `GET /api/v1/generators/prompt-contracts` era publico. No exponia datos de usuarios, pero si inventario de herramientas internas y su nivel de riesgo.

Estado:

- corregido en codigo y verificado en runtime
- ahora requiere admin/VPN

### Baja | Persistia una huella innecesaria de sesion admin en `localStorage`

[`AuthSessionProvider.tsx`](/var/www/edumind_miapp/frontend/src/components/AuthSessionProvider.tsx) seguia sincronizando `admin_user` a `localStorage` por legado. Ya no era necesario porque la proteccion real se hace con cookies de sesion y contexto React.

Estado:

- corregido en esta auditoria

### Baja | La limpieza de salida de IA mejora la presentacion, pero no sustituye una capa anti-alucinacion

La limpieza reforzada en [`content-format.ts`](/var/www/edumind_miapp/frontend/src/lib/content-format.ts) ya elimina mejor artefactos internos (`[Sistema]`, tokens, residuos de instrucciones) y el flujo de impresion insegura de [`WorksheetsTool.tsx`](/var/www/edumind_miapp/frontend/src/pages/tools/WorksheetsTool.tsx) queda saneado. Aun asi, esto solo actua en presentacion.

Impacto:

- reduce exposicion visual de metadialogo o instrucciones internas
- no garantiza por si solo veracidad, trazabilidad ni evidencia normativa

## Correcciones aplicadas en esta auditoria

- alineacion de tests de autenticacion con modo `authentik`
- endurecimiento de `knowledge/categories`, `knowledge/documents` y `knowledge/search`
- endurecimiento de `generators/prompt-contracts`
- saneado de scripts `phase0` a `phase7` para:
  - usar SQLite efimera unica por ejecucion
  - desactivar WAL en verificaciones temporales
  - aceptar `503` publico cuando el edge esta en mantenimiento
  - reflejar correctamente `authentik` como runtime esperado
- reduccion de polling inutil en [`EngineSelector.tsx`](/var/www/edumind_miapp/frontend/src/components/EngineSelector.tsx)
- retirada de residuo `admin_user` en `localStorage`
- mejora de filtrado de artefactos internos en contenido generado
- saneado de impresion HTML en [`WorksheetsTool.tsx`](/var/www/edumind_miapp/frontend/src/pages/tools/WorksheetsTool.tsx)

## Evaluacion de diseno de las fases 0-7

Valoracion general:

- FASES `0` a `6`: bien planteadas y ya sostenibles tecnicamente
- FASE `7`: valida en codigo y runtime interno, pero no en exposicion publica porque el edge sigue en mantenimiento

Lo mejor resuelto hasta ahora:

- redistribucion de concurrencia y admision sobre Redis
- paso serio a PostgreSQL + Alembic
- desacoplamiento de background jobs
- introduccion de SSO unico con Authentik
- endurecimiento del dominio docente

Lo que faltaba cerrar y se ha corregido en esta auditoria:

- deriva entre tests/verificaciones y modo Authentik real
- fuga de catalogo/snippets del corpus
- fuga del catalogo de prompt contracts
- polling redundante de endpoints protegidos

Lo que sigue pendiente de redisenar:

- control anti-alucinacion con evidencia y contratos de salida
- exposicion publica del prompt render para WebGPU
- peso del bundle local
- checklist de cutover real para salir de mantenimiento

## Redisenyo propuesto Fases 8-10

### Fase 8 | Gobernanza de contenido y capa anti-alucinacion

Objetivo:
hacer que la IA solo muestre contenido publicable, con evidencia, sin residuos internos y con validacion previa por tipo de herramienta.

Lineas de trabajo:

- separar corpus `publico`, `privado` y `admin` con ACL explicitas
- introducir validacion previa por herramienta para bloquear payloads incompletos antes de generar
- sustituir `No especificado` por errores `422` o por un bloque de datos faltantes controlado
- convertir herramientas de mayor riesgo (`normativa`, `case`, `defense`, `inspection_report`, `reinforcement_plan`) a salida estructurada validada server-side
- anadir postprocesado server-side de salida:
  - eliminacion de instrucciones internas
  - bloqueo de texto fuera de contrato
  - recorte de metadialogo y residuos de proveedor
- redisenar `render/{tool}`:
  - o bien con tickets efimeros firmados
  - o bien con prompts locales empaquetados por version
  - o bien con prompt cache server-side no legible por cliente
- exigir evidencias/citas para respuestas normativas y marcar `requiere_revision_humana` cuando falte base suficiente

Cierre:
el usuario final solo ve contenido util y publicable; la app no expone instrucciones internas ni empuja al modelo a inventar por falta de datos.

### Fase 9 | Observabilidad operativa y seguridad de explotacion

Objetivo:
pasar de telemetria en memoria a observabilidad real, util para operar y detectar regresiones antes que el usuario.

Lineas de trabajo:

- mover metricas a Prometheus/OpenTelemetry
- limitar cardinalidad de labels y normalizar rutas invalidas
- separar health publico, health interno y health de dependencias
- dashboards de:
  - cola y admision
  - proveedores IA
  - SSO/login/logout
  - background jobs
  - latencias por dominio funcional
- alertas sobre:
  - fallo de cutover SSO
  - errores `5xx`
  - cola saturada
  - degradacion de proveedores
  - worker parado
- auditoria funcional por usuario y dominio con redaccion de PII
- synthetic checks desde edge para `miapp.edumind.es` y `app.edumind.es`

Cierre:
el equipo puede ver degradacion, diagnosticarla y decidir si abrir o cerrar mantenimiento con datos reales.

### Fase 10 | Cutover publico, rendimiento y entrega continua

Objetivo:
dejar la app preparada para salir de mantenimiento, desplegar sin improvisacion y escalar sin romper UX ni seguridad.

Lineas de trabajo:

- crear checklist de salida a publico:
  - desactivar mantenimiento
  - validar SPA fallback
  - validar callback SSO
  - validar rutas protegidas
  - validar `app.edumind.es -> miapp.edumind.es`
- optimizar bundle:
  - aislar `webllm` en carga diferida real
  - separar modo local del shell principal
  - decidir si WebGPU solo se entrega bajo accion explicita del usuario
- pipeline CI/CD con:
  - lint
  - tests backend/frontend
  - smoke tests post-deploy
  - migraciones controladas
  - rollback documentado
- pruebas de carga sobre API, Redis, Postgres y workers
- ejercicios de backup/restore y validacion de recuperacion
- definir topologia objetivo:
  - `frontend estatico`
  - `api`
  - `background worker`
  - `redis`
  - `postgres`
  - `authentik`

Cierre:
la aplicacion queda lista para exponer `miapp.edumind.es` en publico con un proceso repetible, reversible y medible.
