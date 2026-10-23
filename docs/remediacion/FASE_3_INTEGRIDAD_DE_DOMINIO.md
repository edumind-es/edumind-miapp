# FASE 3 - Integridad de dominio

## Objetivo

Cerrar los huecos de integridad en `classroom`, `planner` y `resources`:

- validar datos de entrada antes de tocar BD
- evitar referencias cruzadas entre usuarios
- impedir commits parciales en operaciones compuestas
- reforzar el dominio `teacher_premium` con tests propios

## Cambios implementados

### Validacion fuerte

- `app/schemas_classroom.py` ahora valida:
  - `academic_year` con formato `YYYY-YYYY` y cursos consecutivos
  - rangos de `student_count`
  - colores hexadecimales
  - horas `HH:MM` y rangos `start_time < end_time`
  - longitudes y vacios en titulos, notas, descripciones y campos de clase
  - `generation_params` serializable a JSON

### Classroom

- creacion de clase y generacion de `StudentCode` dentro de una sola transaccion logica
- deteccion de clase activa duplicada para mismo docente/curso/grupo/asignatura/año
- sincronizacion segura del numero de alumnos en actualizacion
- rechazo de reducciones de `student_count` si los codigos a eliminar tienen notas
- rechazo de slots de horario solapados en la misma clase y dia

### Planner

- `resource_id` validado contra recursos del propio usuario
- rechazo de entradas duplicadas para misma clase, fecha y hora de inicio
- actualizaciones protegidas frente a referencias a recursos ajenos

### Resources

- guardado de recurso + link opcional a clase sin commit parcial
- rechazo explicito si `link_to_class_id` no pertenece al usuario
- filtrado defensivo de `get_resources_by_class` por propietario del recurso
- conflicto `409` si un recurso ya esta vinculado a la misma clase

## Verificacion realizada el 2026-04-05

- `tests/test_teacher_premium_domains.py`: `6 passed`
- `scripts/phase0_verify.sh`: OK
  - backend: `96 passed`
  - frontend lint: OK
  - frontend build: OK
- servicio real reiniciado correctamente
- `GET http://127.0.0.1:8100/api/v1/health/simple`: `{"status":"ok"}`

## Riesgos mitigados

- commits parciales al crear clases o guardar recursos con vinculo
- referencias `resource_id` a contenido de otros usuarios
- degradacion silenciosa del mapa de alumnos al cambiar `student_count`
- horarios duplicados o solapados en la misma clase

## Pendiente para fases siguientes

- restricciones e indices reales en base de datos
- migracion de SQLite a PostgreSQL
- desacoplar trabajos pesados del request path
