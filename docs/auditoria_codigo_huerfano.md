# Auditoría de código huérfano · EDUmind MiApp

Fecha: 24 de octubre de 2026 · Base: `main` del repositorio público (`2dea6206`) · Método: análisis estático de solo lectura (grafo de imports, AST de Python, grep sistemático de rutas, clases CSS e identificadores). No se ejecutó nada ni se modificó ningún fichero. Las cifras y riesgos se refieren a esta copia del repositorio; véanse las limitaciones al final de cada bloque.

## Resumen ejecutivo

MiApp está en buen estado estructural: de 124 endpoints, 97 los usa el frontend o el panel de administración, y de 730 funciones y clases del backend solo 13 carecen de referencias. La deuda real se concentra en cuatro focos:

1. **Un pipeline de entrenamiento LoRA que no puede funcionar.** La cola, el worker, las rutas de administración y la pantalla "Training Pipeline" están conectados, pero el script que entrena importa módulos de otro proyecto que no existen aquí y depende de librerías ausentes de `requirements.txt`. Nunca se ha completado un entrenamiento por esta vía (`modelos_lora/versions.json` está vacío) y ningún motor de inferencia carga adaptadores LoRA. El smoke de despliegue exige que ese worker esté corriendo.
2. **Un etiquetado de IA que promete lo que no hay.** El motor "EDUmind Cloud Lite" apunta a un servicio caído (HTTP 526) y, cuando funcionaba, servía un Mistral 7B genérico. El motor público por defecto descarga Llama 3.2 1B al navegador y se presenta como "EDUmind". El motor "Mistral (VPN)" está roto porque nunca recibe clave. El único modelo alojado en el servidor es Gemma 4 por Ollama, restringido a VPN o administradores. La portada anuncia "Modelos propios o BYOK".
3. **Funcionalidad viva pero invisible.** Las pantallas de aula, horarios y planificador semanal existen y funcionan, pero nada enlaza a ellas desde la navegación. Cinco herramientas de generación (rúbricas, fichas, metodología, organización, preguntas) tienen página y backend, pero ninguna ruta. El generador de proyectos ABP tiene backend y tests, pero no página.
4. **Residuos de plantilla y de etapas anteriores.** Capa puente de utilidades CSS sin un solo uso, `App.css`, `tailwind.config.js` inerte, tres dependencias npm sin importar, `nginx_production.conf` duplicado y desactualizado, `repair_deploy.sh` obsoleto y peligroso, scripts de pipeline sin dependencias, documentación que describe un sistema que ya no es.

## Decisiones que corresponden a Luis

| Decisión | Opciones | Qué desbloquea |
|---|---|---|
| **Pipeline LoRA** | (a) Retirar todo el bloque (rutas, servicios, worker, unidades systemd, pantalla admin, docs). (b) Mantenerlo como "no operativo" con aviso en la UI. (c) Rehacerlo de verdad: dependencias, script propio, modelo base y motor que sirva los adaptadores. | Bloque D de limpieza. Con (a) también se simplifican smoke, reload y métricas. |
| **Motor EDUmind Cloud Lite** | (a) Ocultarlo del catálogo mientras Core esté caído y quitarlo como motor recomendado e inicial del Chat. (b) Retirar el proveedor y su gating. (c) Levantar Core de nuevo. | Bloque E. Con (a) o (b) desaparece el único motor que hoy solo produce errores. |
| **Etiquetado de la IA** | Renombrar motores por lo que son ("Llama 3.2 en tu navegador", "Gemma 4 en servidor EDUmind"), retirar "Modelos propios" de la portada y la firma "EDUmind" de cada respuesta del chat, o abrir Gemma 4 al público con control de capacidad. | Bloque E. |
| **Herramientas sin ruta** | Exponer rúbricas, fichas, metodología, organización, preguntas y proyectos ABP en navegación y panel, o retirar sus páginas y métodos. | Bloque C. |
| **Aula y planificador** | Añadir "Aula" y "Planificador" a la navegación y al panel docente, y unificar `/planner` con `/tools/planning`. Distinguir el generador de texto `/tools/planning-ai` del planificador real. | Bloque C (recomendado: exponer). |
| **`@edumind/footer`** | Retirar la dependencia (MiApp usa su copia local) o migrar al paquete. Retirarla elimina la dependencia del registro privado. | Bloque A. |
| **Tabla `apikey`** | Retirar modelo, relación y tabla con migración Alembic tras verificar que está vacía en PostgreSQL, o conservar para un futuro API de terceros. | Bloque F (toca `migrations/`, fichero crítico). |

## Plan de limpieza por bloques (PRs independientes, de menor a mayor riesgo)

| Bloque | Contenido | Riesgo | Requiere decisión |
|---|---|---|---|
| **A. Residuos sin efecto** | `App.css`, `src/assets/react.svg`, capa puente de `index.css` (líneas 600-713), `tailwind.config.js`, `.lam-select`, `lucide-react` y `framer-motion` con sus `manualChunks`, `@edumind/footer` si se decide, favicon de Vite, enlace "Proponer deporte", `repair_deploy.sh`, `nginx_production.conf`, `start_dev.sh`, `backend/test_phase0_verify.db-wal`, exports sin uso (13 tipos y 5 funciones), `model_router.py`, `require_admin`, `track_request`, `QueueManager.check_status/_has_session/_touch_session`, `WeekPlannerRequest`, `deepseek_client` global | Bajo | Solo el footer |
| **B. Endpoints y scripts sin cliente** | 8 endpoints de riesgo bajo (`dataset/items/{id}`, `dataset/documents`, `export/txt`, `export/html`, `planner/entries/{id}`, `health/simple`, `queue/runtime`, raíz `/`), scripts `pipeline/*`, `analyze_feedback.py`, uno de `create_admin.py`/`init_admin.py`, `mistralai` de requirements | Bajo | No |
| **C. Exponer o retirar funcionalidad escondida** | Enlaces a aula y planificador; unificar `/planner`; decidir `/tools/planning-ai`; cinco herramientas sin ruta; generador ABP; tarjeta duplicada de plan de refuerzo en el panel | Medio (producto) | Sí |
| **D. Pipeline LoRA** | Según decisión: rutas `training`, `training_queue_service`, `version_manager`, worker y unidades, `entrenar_lora.py`, pantalla y menú admin, contadores `training_jobs_*`, ajustes en `reload_runtime_services.sh` y smokes, docs | Medio-alto (operación) | Sí |
| **E. Motores de IA y etiquetado** | Catálogo, motor recomendado e inicial, textos de portada, chat y cargador local, motor `mistral`, `AI_PROVIDERS.md`, `README.md` | Medio (producto) | Sí |
| **F. Base de datos** | Modelo `ApiKey` y relación `User.api_keys`, con migración; `TrainingJob` si se retira D | Alto (migraciones) | Sí |
| **G. Documentación** | `README.md` (IA, licencia, comando dev), archivar `plan_mejora.md` y `MODEL_IMPROVEMENT.md`, fechar `ARQUITECTURA_*`, consolidar `phase*_verify.sh` | Bajo | No |

Lo que **no** debe tocarse: `curriculum-service.ts` (trabajo en curso de las matrices, falta la UI), `EDUMIND_APP_OPTIONS` y `_EDUMIND_APP_LABELS` del planificador (datos legítimos del ecosistema), `.b-emocional/.b-social/.b-fisico/.b-interior` (juego completo de Los Cinco Mundos), `public/data/base_datos_convivencia_galicia.json` (respaldo del servicio normativo), `CurriculumMatrixService.reset`, los instaladores del worker de background, la integración iDoceo, WebLLM y Ollama.

## Cifras globales

| Ámbito | Analizado | Sin uso o huérfano |
|---|---|---|
| Endpoints HTTP | 124 | 10 sin cliente, 7 solo en tests, 10 solo en operaciones |
| Funciones, métodos y clases del backend | 730 | 13 reales (más 5 por transitividad) |
| Módulos del backend | 15 servicios + core | 1 (`model_router.py`) |
| Scripts | `backend/scripts/`, `scripts/` | 9 sin invocación |
| Modelos de base de datos | todos | 1 (`ApiKey`); `TrainingJob` según decisión |
| Ficheros TS/TSX | 69 | 6 sin importador (549 líneas) |
| Exports con nombre | — | 34 sin uso externo |
| Rutas del frontend | 32 | 1 sin enlace alguno, 3 escondidas, 1 duplicada |
| Clases CSS propias | 154 | 6 sin uso; capa puente de 169 utilidades sin ningún uso |
| Dependencias npm | 26 | 3 sin importar |
| Motores de IA | 8 | 1 caído, 1 roto, 1 módulo de enrutado muerto |

---

# Inventario 1 · Endpoints HTTP sin cliente
## Cifras
| Clase | Nº |
|---|---|
| Total endpoints | 124 (123 bajo `/api/v1` + `GET /` raíz) |
| USADO (frontend / admin) | 97 |
| SOLO-OPS (smoke, verify scripts) | 10 |
| SOLO-TESTS | 7 |
| SIN USO | 10 |

SOLO-OPS: `GET /health` (phase0_capture_baseline), `GET /health/public` (smoke, preflight, synthetic_edge_checks, reload_runtime_services), `GET /health/dependencies` y `GET /health/internal` (synthetic_edge_checks), `GET /metrics/prometheus` (smoke, preflight), `GET /generators/prompt-contracts` (phase1_verify) y los cuatro de `knowledge` (solo `scripts/phase1_verify.sh`). Nginx solo hace proxy genérico de `/api/v1/`. `GET /auth/sso/callback` cuenta como usado: lo llama el IdP por redirección.

## SIN USO y SOLO-TESTS
| Método | Ruta | Fichero:línea | Evidencia | Riesgo de retirar |
|---|---|---|---|---|
| GET | `/api/v1/dataset/items/{item_id}` | `dataset.py:228` | Frontend solo PUT/DELETE sobre `items/{id}` | Bajo |
| GET | `/api/v1/dataset/documents` | `dataset.py:414` | Sin referencia en frontend, scripts ni tests | Bajo |
| POST | `/api/v1/export/txt` | `export.py:90` | `export-service.ts` solo llama a `/pdf`; TXT se genera en cliente | Bajo |
| POST | `/api/v1/export/html` | `export.py:113` | Ídem; HTML se genera en cliente | Bajo |
| GET | `/api/v1/planner/entries/{entry_id}` | `planner.py:434` | Frontend solo PUT/DELETE | Bajo |
| GET | `/api/v1/health/simple` | `health.py:395` | Solo `test_api.py`; ops usan `/health/public` | Bajo |
| GET | `/api/v1/queue/runtime` | `queue.py:47` | Solo tests de autorización; frontend usa `/queue/status` | Bajo |
| GET | `/` (raíz) | `main.py:95` | Solo tests; nginx no la expone | Bajo |
| POST | `/api/v1/dataset/items` | `dataset.py:195` | El alta se hace vía `upload` | Bajo-medio |
| GET | `/api/v1/knowledge/admin/stats` | `knowledge.py:100` | Sin ninguna referencia | Bajo-medio |
| GET | `/api/v1/training/jobs/{job_id}` | `training.py:148` | `TrainingPipeline.tsx` solo lista `/training/jobs` | Bajo-medio |
| GET | `/api/v1/training/models/latest` | `training.py:96` | Solo tests; podría consultarlo otra app | Bajo-medio |
| GET | `/api/v1/training/logs/{job_id}` | `training.py:271` | Solo tests | Bajo-medio |
| PATCH | `/api/v1/classroom/classes/{class_id}/students/{student_id}` | `classroom.py:347` | Sin cliente; flujo previsto de notas de alumnado | Medio |
| GET | `/api/v1/dataset/export/{filename}` | `dataset.py:477` | Frontend hace POST `/export` pero nunca descarga por GET | Medio |
| POST | `/api/v1/generators/project` | `generators.py:818` | Solo tests (6 refs); generador ABP sin UI | Medio (producto pendiente, no residuo) |
| GET | `/api/v1/metrics` | `health.py:453` | Solo tests; Prometheus usa `/metrics/prometheus` | Medio (posible scrape externo) |

## Routers sin ningún endpoint usado por frontend/admin
- `knowledge`: 4 endpoints solo en `scripts/phase1_verify.sh` y tests; `admin/stats` sin referencia alguna. La recuperación normativa real va por `/normative/*` y `/curriculum/*`.

## Limitaciones
Búsqueda estática; no se revisaron edumind_miclase, edumind_quiz ni campus, ni la configuración de Prometheus/Authentik fuera del repo; no se consultaron logs de acceso de nginx, que serían la confirmación definitiva.

---

# Inventario 2 · Código muerto del backend

## Cifras
- 730 funciones, métodos y clases analizadas (AST + grep).
- 146 sin referencias por grep bruto; 133 están vivas por decorador (endpoints, validadores, middlewares, startup) → 13 candidatas reales, más 5 internas de `model_router.py` muertas por transitividad.
- 1 módulo que nadie importa: `backend/app/services/model_router.py`.
- 9 scripts sin ninguna invocación en deploy, ops, systemd, CI, README ni docs.
- 1 modelo SQLModel sin uso: `ApiKey`.

## Tabla (de más seguro a más dudoso)
| Elemento | Fichero:línea | Tipo | Evidencia | Riesgo de retirar |
|---|---|---|---|---|
| `model_router.py` completo (`ModelTier`, `estimate_response_time`, `should_use_quality_model`, `select_model`, `get_model_config`) | `backend/app/services/model_router.py:37-153` | módulo | Ningún import ni mención en backend, scripts ni tests; `ai_service.py` decide proveedor por su cuenta | Bajo |
| `track_request` (decorador) | `backend/app/services/metrics_service.py:452` | función | Cero usos; `main.py` mide con `metrics_middleware` | Bajo |
| `QueueManager.check_status` | `backend/app/core/queue_manager.py:288` | método | Alias de compatibilidad; todo llama a `reserve_slot` | Bajo |
| `QueueManager._has_session`, `_touch_session` | `backend/app/core/queue_manager.py:149,160` | método | Privados sin llamadas; lógica duplicada en `_reserve_slot_*` | Bajo |
| `require_admin` | `backend/app/api/v1/auth.py:547` | función | Sustituida por `require_admin_from_vpn` en todas las rutas admin | Bajo |
| `WeekPlannerRequest` | `backend/app/schemas_classroom.py:462` | clase | Sin referencias; `GET /planner/week` usa query params | Bajo |
| `pipeline/01_ingest.py`, `02_filter.py`, `03_export.py` | `backend/scripts/pipeline/` | script | Sin invocación; requieren `pandas`/parquet, ausentes de `requirements.txt` | Bajo (no ejecutables en el venv actual) |
| `analyze_feedback.py` | `backend/scripts/analyze_feedback.py` | script | Abre `edumind.db` sqlite relativo; producción es PostgreSQL; usa `requests` (no en requirements) | Bajo |
| `start_dev.sh` | `backend/scripts/start_dev.sh` | script | Ruta hardcodeada y puerto 8000 (el servicio usa 8100) | Bajo (obsoleto) |
| `VersionManager.get_version` | `backend/app/services/version_manager.py:116` | método | Sin referencias | Bajo técnico; bloque LoRA → decisión de Luis |
| `MetricsCollector.record_ai_request`, `record_training_job` | `backend/app/services/metrics_service.py:224,252` | método | Nunca invocados; sus contadores se exportan siempre a 0 en el snapshot (líneas 308-328) | Medio: retirar junto con las claves del snapshot |
| `get_background_queue_stats` | `backend/app/services/background_task_queue_service.py:108` | función | Sin referencias; `admin.py` solo expone la cola de entrenamiento | Medio: más "no conectada" que muerta |
| `CurriculumMatrixService.reset` | `backend/app/services/curriculum_matrix_service.py:71` | método | Sin referencias | Medio: útil tras reimportar matrices; conservar |
| `install_background_worker_service.sh`, `install_background_worker_user_service.sh` | `backend/scripts/` | script | No referenciados en docs ni deploy; los homólogos de training sí | Medio: instaladores de un solo uso del worker que el smoke exige |
| `create_admin.py` y `init_admin.py` | `backend/scripts/` | script | Duplicados; ninguno invocado | Medio: conservar uno (`create_admin.py`, usa el hash de la app) |
| `ApiKey` | `backend/app/models.py:48` | modelo | Tabla creada en `0001` e indexada en `0002`; relación `User.api_keys`; ninguna consulta, ruta ni script la usa | Medio/alto: requiere migración Alembic y verificar en PostgreSQL que está vacía |

## Caso aparte: entrenamiento LoRA y versiones de modelo (solo documentación)
**Piezas.** `training.py` (8 rutas admin-VPN: modelos, jobs, cola, `prepare`, `start`, `logs`); `training_queue_service.py` (cola en tabla `trainingjob`, lanza `scripts/entrenar_lora.py` por subproceso con timeout de 6 h y registra en `version_manager`); `version_manager.py` (crea `modelos_lora/` y `versions.json` al importar); `scripts/training_worker.py` + unidades systemd `edumind-miapp-training-worker`; `entrenar_lora.py` (QLoRA con peft/transformers, base Mistral-7B); modelo `TrainingJob`; contadores `training_jobs_*`.

**Conexiones vivas.** Página admin `TrainingPipeline.tsx`, menú "Entrenamiento", enlace en `AdminDashboard.tsx`; `reload_runtime_services.sh` reinicia el worker; `post_deploy_smoke.sh` y `load_smoke_local.sh` fallan si el worker no corre; `test_training.py` solo comprueba auth.

**Estado real.**
1. `entrenar_lora.py` importa `app_config` y `utils.training_pipeline`, módulos que no existen en este repo (son de otro proyecto); `peft`, `transformers`, `datasets` y `torch` no están en `requirements.txt`. Cualquier job encolado falla al arrancar el subproceso. La cola funciona; el entrenamiento, no.
2. Desajuste de rutas: el script escribiría en `modelos_lora/<perfil>/<carpeta>` pero la cola registra `modelos_lora/<version>`; `GET /logs` lee un `training.log` global que nada escribe.
3. Ningún camino de inferencia carga adaptadores LoRA: `ai_service.py` habla con Ollama o con EDUmind Core. `versions.json` vacío es coherente: nunca se completó un entrenamiento por esta vía.
4. Los contadores `training_jobs_*` del snapshot siempre valen 0.

**Qué pasaría al retirar.** Todo el bloque: tocar `admin.py` (import, `training_queue`, `total_training_jobs`), `api.py`, página y menú admin, `test_training.py`, métricas; `TrainingJob` quedaría como `ApiKey`. Solo el worker: ajustar `reload_runtime_services.sh`, ambos smokes, README y `TRAINING_QUEUE_WORKER.md`, y deshabilitar el servicio en el host. Solo `entrenar_lora.py`: `POST /start` devolvería 500 "Training script not found". Mantener: coste cero salvo un worker ocioso.

## Limitaciones
Búsqueda por nombre: no detecta llamadas dinámicas ni nombres reutilizados; no se analizó código muerto dentro de funciones vivas; no se comprobó el estado de servicios en el host ni tablas en PostgreSQL; crontabs del host fuera del repo podrían invocar scripts.

---

# Inventario 3 · Frontend

## Cifras
- 69 ficheros TS/TSX; 6 sin ningún importador (549 líneas) más un asset; 34 exports con nombre sin uso externo.
- 25 rutas en `App.tsx` y 7 en `AdminApp.tsx`: 1 sin enlace alguno, 3 sin enlace desde la navegación principal, 1 duplicada.
- CSS: `App.css` sin importar; 6 de 154 clases de `@layer components` sin uso; capa puente de `index.css` con 169 utilidades remapeadas y 0 usadas; `tailwind.config.js` inerte.
- Dependencias: 3 de 10 sin ningún import (`lucide-react`, `framer-motion`, `@edumind/footer`). Impacto en bundle 0 KB (Rollup ya las excluye).

## 1. Ficheros y exports sin referencias
| Elemento | Fichero:línea | Evidencia | Riesgo |
|---|---|---|---|
| `src/assets/react.svg` | — | Plantilla Vite, sin import | Bajo |
| `MethodologyTool.tsx` | `src/pages/tools/MethodologyTool.tsx` (80 l.) | Sin `lazy(import)`, ruta ni enlace; el backend sí tiene el generador (`generators.py:1012`) | Bajo (medio si se quería exponer) |
| `OrganizationTool.tsx` | `src/pages/tools/OrganizationTool.tsx` (96 l.) | Ídem; backend `generators.py:1025` | Bajo |
| `QuestionTool.tsx` | `src/pages/tools/QuestionTool.tsx` (115 l.) | Ídem; backend `generators.py:1038` | Bajo |
| `RubricsTool.tsx` | `src/pages/tools/RubricsTool.tsx` (112 l.) | Ídem; backend `generators.py:986` | Bajo |
| `WorksheetsTool.tsx` | `src/pages/tools/WorksheetsTool.tsx` (146 l.) | Ídem; backend `generators.py:999` | Bajo |
| `generatorService.generateRubrics/Worksheets/Methodology/Organization/Questions` | `src/lib/generator-service.ts:291-305` | Solo los llaman las 5 páginas anteriores | Bajo (si se retiran las páginas) |
| Ramas `rubrics/worksheets/methodology/organization` | `src/lib/local-prompt-builder.ts:50-52, 225-250` | Solo alcanzables desde lo anterior | Bajo (misma condición) |
| `normalizeAdminPortalCandidate` | `src/lib/admin-portal.ts:23` | Sin usos externos | Bajo |
| `getStoredToken` | `src/lib/auth-client.ts:69` | Sin usos externos | Bajo |
| `stripSystemLines` | `src/lib/content-format.ts:38` | Sin usos externos | Bajo |
| `ALL_COURSES`, `getStageFromCourse` | `src/lib/education-levels.ts:61, 66` | Sin usos externos | Bajo |
| 13 tipos exportados sin uso externo (`NoticeVariant`, `AuthSessionValue`, `DefaultDestination`, `CreatePlannerEntryRequest`, `GeneratedPlannerSession`, `SaveResourceRequest`, `ExportOptions`, `GeneratorRequest`, `NEAECategory`, `NEAELevel`, `CurriculumCatalogResponse`, `NormativeStatusResponse`, `PedagogicalModelOption`, `InvalidNavigationTelemetryPayload`) | varios | Basta quitar `export` | Bajo (higiene) |
| `curriculum-service.ts` (177 l.) | `src/lib/curriculum-service.ts` | Nadie lo importa; añadido el 23-10 con las matrices | **Alto: no retirar**, falta la UI que lo consuma |

## 2. Rutas sin enlace
| Elemento | Fichero:línea | Evidencia | Riesgo |
|---|---|---|---|
| `/tools/planning-ai` → `PlanningTool` | `App.tsx:91` | Ningún enlace en todo `src`; Navbar y Dashboard enlazan `/tools/planning` (WeeklyPlanner) | Bajo-medio: decidir si se enlaza o se retira con `PlanningTool.tsx` y `generatePlanning` |
| `/planner` → `WeeklyPlanner` | `App.tsx:111-118` | Mismo componente que `/tools/planning`; solo enlazado desde `ClassManager.tsx:58` y `ClassDetail.tsx:219` | Bajo: unificar en una ruta |
| `/classroom` → `ClassManager` | `App.tsx:103` | Sin enlace en Navbar/Dashboard/Home; solo desde el botón "Mis clases" de `WeeklyPlanner.tsx:435` | Medio: funcionalidad viva pero escondida |
| `/classroom/:id` → `ClassDetail` | `App.tsx:107` | Solo desde `ClassManager` | Medio (ligada a la anterior) |

Nota: `Dashboard.tsx:38` y `:51` repiten la herramienta `reinforcement_plan` en dos perfiles.

## 3. CSS
| Elemento | Fichero:línea | Evidencia | Riesgo |
|---|---|---|---|
| `src/App.css` | completo (60 l.) | Nadie lo importa; plantilla Vite | Bajo |
| Capa puente entera | `index.css:600-713` (~5 KB de 19,5 KB) | 169 utilidades remapeadas, ninguna aparece en `src/**/*.tsx`; el comentario la declara provisional | Bajo: retirable completa |
| `tailwind.config.js` | completo | Tailwind 4 no lo lee sin `@config`; define tokens shadcn sin variables; nada usa `bg-background`, `rounded-*`, `shadow-*` | Bajo |
| `.lam-select` | `index.css:367` | Sin usos (los `<select>` usan `lam-input`) | Bajo |
| `.b-emocional`, `.b-social`, `.b-fisico`, `.b-interior` | `index.css:416-420` | Solo `.b-mental` se usa | Medio: juego completo de Los Cinco Mundos, conservar |
| `.lam-seg > button.is-active` | `index.css:352` | Nada usa `is-active`; `[aria-pressed="true"]` cubre el caso | Bajo-medio |
| `.footer-nav` | `EDUmindFooter.css` | El bloque de navegación del pie nunca se renderiza en MiApp (`hideNavigation`) | Bajo-medio (componente compartido) |

## 4. Dependencias
| Elemento | Fichero:línea | Evidencia | Riesgo |
|---|---|---|---|
| `lucide-react` | `package.json:14`; `vite.config.ts:41` (`manualChunks` "icons") | 0 imports; sin chunk en `dist` | Bajo; quitar también de `manualChunks` |
| `framer-motion` | `package.json:13`; `vite.config.ts:40` ("motion") | 0 imports; sin chunk | Bajo; ídem |
| `@edumind/footer` | `package.json:9`; `.npmrc:1` | 0 imports; MiApp usa su copia local `EDUmindFooter.tsx` | Bajo-medio: quitarla elimina la dependencia del registro privado; confirmar que no se quería migrar al paquete |
| `autoprefixer` | `package.json:24`; `postcss.config.js:5` | Referenciada, pero Tailwind 4 ya aplica prefijos | Bajo-medio |

Bundle actual: `webllm` 5,5 MB (lazy, usado), `react-vendor` 225 KB, `vendor` 65 KB, CSS 39 KB.

## 5. Restos de otras apps
| Elemento | Fichero:línea | Evidencia | Riesgo |
|---|---|---|---|
| "Proponer deporte" → `/proponer-deporte` | `EDUmindFooter.tsx:172-174` | Ruta inexistente (cae en `NotFound`); vocabulario de Liga EDUmind | Bajo |
| Navegación anterior/inicio/siguiente del pie | `EDUmindFooter.tsx:116-133` | Patrón de recursos HTML paginados; nunca activo en una SPA | Bajo-medio |
| Favicon `/vite.svg` | `index.html:6`, `public/vite.svg` | Plantilla Vite, no identidad EDUmind | Bajo (sustituir) |
| `EDUMIND_APP_OPTIONS` (Quiz, Motion, Pasos, Robotics, Geobreath, Liga de Valores, Moodle) | `WeeklyPlanner.tsx:29-37` | Selector "app usada en la sesión": referencia intencionada al ecosistema | **Mantener** |

`public/data/base_datos_convivencia_galicia.json` (1,4 MB) lo lee el backend como respaldo (`normative_service.py:156`): no es basura.

## Limitaciones
Grep de identificadores: no ve usos dinámicos ni re-exports encadenados; no se ejecutaron `knip`/`ts-prune` ni un build nuevo; no se revisaron enlaces externos (Ghost, correos, otras apps) que apunten a `/classroom` o `/tools/planning-ai`.

---

# Inventario 4 · Motores de IA, integraciones y documentación

## 1. Mapa de motores de IA
Catálogo servido por `GET /api/v1/config/engines` (`backend/app/api/v1/config.py:73-139`): públicos webgpu (por defecto), edumind, chatgpt, deepseek, claude, gemini; privados (admin o IP VPN) mistral, ollama. Implementación única en `AIService.stream_chat` (`backend/app/services/ai_service.py:118-338`).

| Motor | Implementación | Variables | Quién lo ve | Estado según código | Observación |
|---|---|---|---|---|---|
| `webgpu` "Tu Dispositivo" | Solo frontend: `webllm-service.ts:21,42`, `generator-service.ts:77-113` | Ninguna | Público, por defecto | Vivo | Descarga `Llama-3.2-1B-Instruct-q4f32_1-MLC` desde HuggingFace (MLC). Es Llama 3.2 1B de Meta, no un modelo EDUmind. El system prompt lo presenta como "Eres EDUmind" (`webllm-service.ts:31`). |
| `edumind` "EDUmind Cloud Lite" | `ai_service.py:231-305` (POST a `{EDUMIND_CORE_URL}/v1/chat/completions`) | `EDUMIND_CORE_URL`, `EDUMIND_CORE_TOKEN` | Público, con control de admisión | Código vivo, servicio caído (HTTP 526) | El modelo que pide al Core es `mistral-7b-instruct-v0.1.Q4_K_M.gguf` (`ai_service.py:261`): un Mistral 7B genérico, no un fine-tune. Es el `recommended_engine` salvo degradación y el motor inicial del Chat (`Chat.tsx:62`). |
| `chatgpt` | `ai_service.py:160-172` (`gpt-4o`) | Ninguna del sistema | BYOK | Vivo | No documentado en `backend/docs/AI_PROVIDERS.md`. |
| `deepseek` | `ai_service.py:132-145` | `DEEPSEEK_API_KEY` (respaldo solo admin) | BYOK | Vivo | `deepseek_client` global (`ai_service.py:38`) se crea y nunca se usa. |
| `claude` | `ai_service.py:174-196` (`claude-3-5-sonnet-20241022`) | `CLAUDE_API_KEY` (respaldo solo admin) | BYOK | Vivo | Identificador de modelo antiguo. |
| `gemini` | `ai_service.py:198-229` (`gemini-2.0-flash`) | `GEMINI_API_KEY` (respaldo solo admin) | BYOK | Vivo | — |
| `mistral` "Mistral (VPN)" | `ai_service.py:147-158` (API cloud `api.mistral.ai`) | `MISTRAL_API_KEY` definida pero nunca leída por `chat.py`/`generators.py` | VPN/admin | **Roto**: sin clave en la petición el cliente falla | API cloud de pago etiquetada "(VPN)" como si fuera local. `mistralai` en `requirements.txt:13` no se importa en ningún sitio. |
| `ollama` "Gemma 4 Local (VPN)" | `ai_service.py:307-335` | `OLLAMA_URL` (127.0.0.1:11435), `OLLAMA_DEFAULT_MODEL` (`gemma4:e4b`) | VPN/admin | Vivo | Único modelo realmente alojado en el servidor EDUmind. |

**Fuera del catálogo o sin implementación.** `model_router.py` (muerto, ver bloque B). Pipeline LoRA completo (ver inventario 2, caso aparte): la UI de admin "Training Pipeline" ofrece entrenar modelos que fallarían al arrancar y que ningún motor serviría. `system_prompts.py:74-88` tiene perfiles para mistral, edumind y ollama; el prompt de webgpu vive en el frontend.

**Fallback entre motores.** Solo hacia WebGPU: cabecera `X-EDUMIND-FALLBACK` al denegar `edumind` (`chat.py:71`, `generators.py:383`); `generator-service.ts:150-168` cae a WebGPU si Cloud Lite responde 503 o el stream contiene "cloud lite"; `EngineSelector.tsx:206-223` conmuta al motor recomendado. El Chat no tiene fallback automático.

## 2. Textos visibles que prometen "IA EDUmind" o modelos propios
Frontend: `Home.tsx:102` ("IA local y en la nube"), `Home.tsx:116` (chip "Modelos propios o BYOK", **falso hoy**), `Home.tsx:163` ("EDUmind en la nube, local (WebGPU) o clave propia"), `EngineSelector.tsx:280,285,301`, `generator-service.ts:95,161,166,236`, `WebLLMLoader.tsx:33,117` ("Cargando conocimiento educativo" para un Llama genérico), `webllm-service.ts:31` ("Eres EDUmind"), `Chat.tsx:241,308,338` (etiqueta "EDUmind" en cada respuesta sea cual sea el motor), `GeneratorLayout.tsx:253` ("Uso demo en la nube"), `TrainingPipeline.tsx:178,310,315`, `AdminDashboard.tsx:118,139`.

Backend: `config.py:82-84,172`, `ai_service.py:239,250,275,297,302`, `generators.py:149,496,546`, `health.py:161`, `admission_control_service.py:393`, `chat.py:106` y `generators.py:642` (mensaje en inglés "Sustainability Mode: You must provide your own API Key"), `prompts.py:28-36` (ver §5).

## 3. Integraciones externas
| Integración | Ficheros | Viva según código | Riesgo de retirar |
|---|---|---|---|
| EDUmind Core | `config.py:93-94`, `ai_service.py:231-305`, `health.py:154-175`, `config.py:82,170-173,205-210`, `provider_observability_service.py`, `admission_control_service.py`; frontend `EngineSelector.tsx`, `generator-service.ts`, `Chat.tsx:62` | Código vivo; servicio caído | Medio: retocar catálogo, motor recomendado, motor inicial del Chat, mensajes y tests (`test_generators.py`, `test_queue_admission.py`, `test_admin_observability.py`). Beneficio: desaparece el único motor gestionado que hoy solo da errores. |
| Authentik / SSO | `config.py:46-60,159-164,255-269`, `auth.py:201-203,589-597,667-760`, `auth-client.ts`, `AdminLogin.tsx:163-262` | Viva y condicional (`AUTH_MODE=local` la desactiva) | Bajo si se deja en `local`. Solo afecta al login de admin. |
| iDoceo (matrices) | `importar_matrices_idoceo.py`, `curriculum_matrix_parser.py`, `curriculum_matrix_service.py`, `docs/matrices_curriculares.md` | Viva; importación offline | Alto: sostiene el currículo de 17 territorios. No retirar. |
| Matomo | Solo `docs/remediacion/baselines/2026-04-05_baseline_inicial.md:43-44` | Retirada; sin restos en código | Ninguno. |
| Webhook de alertas de proveedor | `provider_alert_push_service.py:44,194-254`, `generators.py:593-594`, `background_task_queue_service.py`, `scripts/background_task_worker.py`, unidades systemd del background worker | Viva pero inactiva salvo URL configurada en admin | Bajo: canal opcional; retirarlo implica podar el tipo de job del worker. |
| Correo | — | No existe envío de correo | N/A. Las invitaciones se generan por CLI (`ops/crear_invitacion.sh`). |
| Prometheus | `metrics_service.py:368`, `health.py:453,511-517`, `preflight_release.sh:60`, `post_deploy_smoke.sh:27` | Endpoint vivo; sin scrape configurado en el repo | Bajo: retirar el endpoint rompería preflight y smoke. |
| WebLLM / WebGPU | `package.json:15` (`@mlc-ai/web-llm`), `webllm-service.ts`, `WebLLMLoader.tsx`, `device-capability.ts`, `local-prompt-builder.ts`, `scripts/verify_webllm_split.sh` | Viva, motor público por defecto | Alto: único motor público gratuito que funciona hoy. Depende de HuggingFace y de WebGPU; la etiqueta no dice qué modelo es. |
| Ollama local | `ai_service.py:307-335`, `health.py:346`, `config.py:88-90`, scripts `analyze_feedback.py` y `pipeline/02_filter.py` | Viva (VPN/admin) | Medio: sin él no queda ningún modelo en servidor. |

## 4. Documentación y ficheros de raíz
| Fichero | Qué describe | Qué ya no existe o está duplicado | Propuesta |
|---|---|---|---|
| `README.md` | Stack, instalación, deploy | "IA: EDUmind Core + Ollama" (omite WebGPU y BYOK; Core caído); `uvicorn app.main:app --port 8003` (el entrypoint es `main:app`, puerto 8100); "Licencia GNU GPL v3" (el repo es AGPL-3.0 + EUPL-1.2); Grafana en `console.edumind.es` sin configuración en el repo; worker LoRA presentado como operativo | Reescribir sección IA y licencia; corregir comando dev. |
| `plan_mejora.md` | Plan fases 0-10 (cerrado 2026-04-09) | Hoja de ruta histórica ya ejecutada | Mover a `docs/remediacion/`. |
| `docs/MODEL_IMPROVEMENT.md` | Plan de fine-tuning LoRA | Describe un pipeline que no funciona; recomienda Phi-3-mini | Archivar o marcar "no implementado". |
| `docs/remediacion/ARQUITECTURA_EDUMIND_MIAPP.md` | Arquitectura observada 2026-04-05 | "SQLite por defecto", `modelos_lora/` como almacén, servicios ya inexistentes | Fechar como instantánea histórica. |
| `docs/remediacion/FASE_*.md`, `AUDITORIA_*.md`, `CHECKLIST_CUTOVER_PUBLICO.md`, `baselines/` | Bitácora de fases | Histórico coherente | Mantener como archivo. |
| `backend/docs/AI_PROVIDERS.md` | Estado de proveedores | Faltan ChatGPT y Ollama; dice "Bearer token" para Core (el código usa `X-Api-Key`); no refleja tiers ni control de admisión | Reescribir desde la tabla de §1 o eliminar. |
| `backend/docs/TRAINING_QUEUE_WORKER.md` | Flujo de cola LoRA | Describe un worker cuyo script no puede importar sus dependencias | Marcar como no operativo o retirar con el pipeline. |
| `backend/docs/MIGRATIONS.md`, `docs/matrices_curriculares.md` | Alembic; matrices | Vigentes | Mantener. |
| `nginx_production.conf` | vhost `miapp.edumind.es` | Duplicado y desactualizado respecto a `ops/nginx/edumind-ai-pro.conf`, la plantilla real que usa `scripts/cutover_activate_public.sh:6` | Eliminar o dejar como referencia a `ops/nginx/`. |
| `deploy/app.edumind.es.conf` | Redirección `app.edumind.es` → `miapp.edumind.es` | Vigente | Mantener. |
| `repair_deploy.sh` | "Reparación" de systemd, nginx y certbot | Escribe el servicio en puerto 8000 con 3 workers (el real es 8100), borra el vhost del dominio antiguo, ejecuta certbot para `app.edumind.es`. Nadie lo invoca | **Obsoleto y peligroso**: eliminar. |
| `backend/Dockerfile` | Imagen backend | `CMD uvicorn main:app --port 8000`; ningún script ni CI lo usa | Confirmar uso; si no, retirar. |
| `maintenance.html` | Página "En obras" | Carga Google Fonts (único tercero externo) | Vigente; opcional inlinear fuentes. |
| `scripts/phase0…phase10_verify.sh`, `phase0_capture_baseline.sh` | Verificadores por fase | Histórico; el README manda ejecutar `phase10_verify.sh` como "tests" | Consolidar en un `verify.sh` o mover a `scripts/remediacion/`. |
| `.claudeignore` | Excluye `backend/modelos_lora/` | Carpeta vacía | Cosmético. |

## 5. Restos de otras apps (fuera del frontend)
- `backend/app/core/prompts.py:28-36`: el system prompt base instruye al modelo a "sugerir la integración con estas plataformas propias" (Robotics, Motion, Quiz, Pasos, Geobreath, Liga de Valores, Moodle en `moodle.losmundosedufis.com`). Marketing cruzado dentro de cada respuesta de IA, con el dominio antiguo. `prompts.py:254` y `:523` (GIFT para Moodle) son funcionales.
- `backend/app/api/v1/planner.py:63-71` `_EDUMIND_APP_LABELS` y `WeeklyPlanner.tsx:30-36`: etiquetas del desplegable "app usada en la sesión" del planificador. Legítimas.
- `repair_deploy.sh:50-52`: vhost `miapp.losmundosedufis.com`. `ai_service.py:232`: comentario con `core.losmundosedufis.com`.
- No hay rutas, scripts ni configuración de Liga EDUmind, MiClase, Quiz o Campus en backend, ops ni deploy.

## Limitaciones
Auditoría estática: no se ejecutó backend, tests ni build. "mistral roto" y "entrenar_lora.py no arranca" se deducen de imports y `requirements.txt`. No se inspeccionó `.env` ni la tabla de configuración de app (webhook, overrides). Los tests solo se revisaron por grep.

---

EDUmind® · Luis Vilela Acuña · Informe generado con asistencia de Claude Code el 24-10-2026.
