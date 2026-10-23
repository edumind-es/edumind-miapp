# Training Queue Worker (Fase 3)

EDUmind usa una cola **persistente en base de datos** para jobs largos de entrenamiento LoRA.

## Flujo

1. `POST /api/v1/training/prepare` crea un `TrainingJob` en estado `ready`.
2. `POST /api/v1/training/start/{job_id}` mueve el job a estado `queued`.
3. Uno o varios workers (`scripts/training_worker.py`) reclaman jobs `queued` de forma atómica.
4. El worker ejecuta `scripts/entrenar_lora.py` y persiste estado final:
   - `training` durante ejecución
   - `completed` si termina correctamente
   - `failed` si hay error/timeout

## Ejecución de worker

Desde `backend/`:

```bash
python scripts/training_worker.py
```

Opciones útiles:

```bash
python scripts/training_worker.py --once
python scripts/training_worker.py --worker-id worker-a --poll-interval 2
python scripts/training_worker.py --max-jobs 5
```

## Ejecución como servicio systemd

Unidad versionada en repo:

- `deploy/systemd/edumind-miapp-training-worker@.service`
- `deploy/systemd-user/edumind-miapp-training-worker.service`

Instalación (root):

```bash
sudo /var/www/edumind_miapp/backend/scripts/install_training_worker_service.sh 1
```

Gestión:

```bash
sudo systemctl status edumind-miapp-training-worker@1.service
sudo systemctl restart edumind-miapp-training-worker@1.service
sudo journalctl -u edumind-miapp-training-worker@1.service -f
```

### Alternativa sin root (`systemd --user`)

Instalación:

```bash
/var/www/edumind_miapp/backend/scripts/install_training_worker_user_service.sh
```

Gestión:

```bash
systemctl --user status edumind-miapp-training-worker.service
systemctl --user restart edumind-miapp-training-worker.service
journalctl --user -u edumind-miapp-training-worker.service -f
```

## Observabilidad

- `GET /api/v1/training/queue/stats`
- `GET /api/v1/admin/observability`
