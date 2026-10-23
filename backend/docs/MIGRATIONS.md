# Database Migrations (Alembic)

## Current strategy
- Development compatibility: `RUNTIME_ENV=development`, `DATABASE_URL=sqlite:///./edumind.db`, `DB_AUTO_CREATE=true`.
- Production-ready mode: `RUNTIME_ENV=production`, PostgreSQL, `DB_MANAGED_BY_ALEMBIC=true` y `DB_AUTO_CREATE=false`.
- El directorio de migraciones es `backend/migrations/` y se ejecuta mediante `scripts/run_migrations.py`.

## Commands
From `backend/`:

```bash
.venv/bin/python scripts/run_migrations.py upgrade head
```

Show current revision:

```bash
.venv/bin/python scripts/run_migrations.py current
```

Create new migration:

```bash
.venv/bin/python scripts/run_migrations.py revision -m "describe change"
```

Autogenerate (if desired):

```bash
.venv/bin/python scripts/run_migrations.py revision --autogenerate -m "schema change"
```

Stamp an existing schema baseline:

```bash
.venv/bin/python scripts/run_migrations.py stamp 20260214_0001
```

Downgrade one step:

```bash
.venv/bin/python scripts/run_migrations.py downgrade -1
```

## SQLite -> PostgreSQL cutover

1. Back up the current SQLite database:

```bash
./scripts/backup_db.sh
```

2. Provision PostgreSQL and run migrations to `head`.

3. Copy data from SQLite:

```bash
.venv/bin/python scripts/migrate_sqlite_to_postgres.py \
  --source sqlite:///./edumind.db \
  --target postgresql+psycopg://USER:PASSWORD@127.0.0.1:5435/edumind_miapp \
  --truncate-target
```

4. Update `.env` with:

```bash
RUNTIME_ENV=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@127.0.0.1:5435/edumind_miapp
DB_AUTO_CREATE=false
DB_MANAGED_BY_ALEMBIC=true
```

5. Restart the API process so it reconnects against PostgreSQL.

## Verification

Run the full persistence check from repo root:

```bash
./scripts/phase4_verify.sh
```
