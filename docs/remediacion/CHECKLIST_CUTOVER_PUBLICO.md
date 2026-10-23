# Checklist de Cutover Publico

## Antes del cutover

- `./scripts/phase10_verify.sh`
- confirmar `https://console.edumind.es` operativo
- confirmar backup reciente en `backend/backups/`
- confirmar `readlink -f /etc/nginx/sites-enabled/edumind-ai-pro` apunta a mantenimiento

## Apertura

```bash
cd /var/www/edumind_miapp
./deploy.sh
./scripts/post_deploy_smoke.sh --public-mode maintenance
./scripts/cutover_activate_public.sh
./scripts/post_deploy_smoke.sh --public-mode live
```

## Rollback

```bash
cd /var/www/edumind_miapp
./scripts/cutover_enable_maintenance.sh
./scripts/post_deploy_smoke.sh --public-mode maintenance
```

## Restauracion de base de datos

```bash
cd /var/www/edumind_miapp/backend
./scripts/restore_db.sh --dry-run --backup-file ./backups/edumind_YYYYMMDD_HHMMSS.sql.gz
./scripts/restore_db.sh --force --backup-file ./backups/edumind_YYYYMMDD_HHMMSS.sql.gz
```
