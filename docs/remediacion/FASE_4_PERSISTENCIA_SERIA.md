# FASE 4 | Persistencia seria

Estado: ejecutada el `2026-04-05`

## Objetivo

Sacar la app del modo de persistencia "comodo" para dev y dejarla en un camino valido para produccion: PostgreSQL, migraciones versionadas y bootstrap controlado.

## Cambios aplicados

- `backend/.env` migrado a PostgreSQL en `127.0.0.1:5435`
- `RUNTIME_ENV=production`, `DB_MANAGED_BY_ALEMBIC=true` y `DB_AUTO_CREATE=false`
- `backend/app/core/config.py` endurecido:
  - validacion de `RUNTIME_ENV`
  - PostgreSQL obligatorio en `staging` y `production`
  - Alembic obligatorio para despliegues PostgreSQL
  - normalizacion de `DEBUG=release` para no romper imports
- `backend/app/db.py` endurecido:
  - pooling real para PostgreSQL
  - `pool_pre_ping`, `pool_timeout` y `pool_recycle`
  - PRAGMAs SQLite para `foreign_keys`, `WAL` y `busy_timeout`
  - `create_all` limitado a SQLite de desarrollo
- directorio de migraciones renombrado a `backend/migrations/` para no colisionar con el paquete Python `alembic`
- nuevo wrapper operacional en `backend/scripts/run_migrations.py`
- nuevo importador de datos en `backend/scripts/migrate_sqlite_to_postgres.py`
- `deploy.sh` actualizado para ejecutar migraciones antes del restart
- `backup_db.sh` actualizado para soportar SQLite y PostgreSQL
- `scripts/phase4_verify.sh` actualizado para validar upgrade/downgrade/upgrade en base efimera

## Base de datos objetivo

- contenedor Docker: `edumind-miapp-postgres`
- volumen Docker: `edumind_miapp_postgres_data`
- puerto host: `127.0.0.1:5435`
- base de datos: `edumind_miapp`
- revision Alembic aplicada: `20260405_0002`

## Migraciones nuevas

- `20260405_0002_persistence_hardening.py`

Incluye:

- indices compuestos para `activitylog`, `apikey`, `classschedule`, `generatedresource`, `plannerentry` y `teacherclass`
- unique constraints reales para:
  - `studentcode (class_id, code)`
  - `studentcode (class_id, number)`
  - `resourcelink (resource_id, class_id)`

## Corte de datos ejecutado

- backup previo del SQLite runtime
- migracion de esquema a PostgreSQL con Alembic
- copia de datos desde `backend/edumind.db` a PostgreSQL
- verificacion de conteos basicos entre origen y destino:
  - `user`: `13`
  - `teacherclass`: `1`
  - `studentcode`: `3`
  - `document`: `0`
  - `apikey`: `0`

## Riesgo cerrado

- la API ya no depende de `create_all` en produccion
- la persistencia deja de estar acoplada a SQLite
- las migraciones pasan a ser repetibles y versionadas
- la BD principal queda lista para crecer en concurrencia y workers
- existe smoke test automatizado del ciclo de rollback de esquema

## Nota operativa

El servicio `edumind-miapp.service` corre como `nuevoadmin`, asi que el cambio efectivo de runtime requiere reiniciar el proceso una vez actualizados codigo y `.env`.
