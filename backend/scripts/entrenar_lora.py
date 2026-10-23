#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

"""CLI entry point to fine-tune LoRA adapters for EDUmind."""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments

from app_config import settings
from utils.training_pipeline import TrainingManager


def read_jsonl(path: Path) -> List[dict]:
    rows: List[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def format_example(example: dict) -> str:
    prompt = example.get("prompt", "").strip()
    completion = example.get("completion", "").strip()
    context = example.get("input", "").strip()
    if context:
        return (
            "### Instruction:\n"
            f"{prompt}\n\n"
            "### Contexto adicional:\n"
            f"{context}\n\n"
            "### Respuesta:\n"
            f"{completion}"
        )
    return (
        "### Instruction:\n"
        f"{prompt}\n\n"
        "### Respuesta:\n"
        f"{completion}"
    )


def append_log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line, flush=True)
    log_path = settings.training_log
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def resolve_dataset_path(raw_path: Optional[str]) -> Optional[Path]:
    if not raw_path:
        return None
    path = Path(raw_path)
    if path.is_file():
        return path
    candidate = settings.base_dir / raw_path
    if candidate.is_file():
        return candidate
    candidate = settings.training_dir / raw_path
    if candidate.is_file():
        return candidate
    return path if path.exists() else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entrena un adaptador LoRA usando los lotes validados.")
    parser.add_argument("--perfil", default="opositores", help="Perfil a entrenar (opositores, docentes, centros).")
    parser.add_argument("--batch-id", help="Identificador de lote generado por el panel de entrenamiento.")
    parser.add_argument("--dataset", help="Ruta al dataset JSONL. Si no se indica, se usará el lote pendiente.")
    parser.add_argument("--base-model", default="mistralai/Mistral-7B-v0.1", help="Modelo base para el ajuste fino.")
    parser.add_argument("--output-name", help="Nombre de carpeta de salida. Por defecto usa el batch ID.")
    parser.add_argument("--epochs", type=int, default=3, help="Número de épocas de entrenamiento.")
    parser.add_argument("--learning-rate", type=float, default=2e-4, help="Tasa de aprendizaje.")
    parser.add_argument("--per-device-batch", type=int, default=2, help="Tamaño de batch por dispositivo.")
    parser.add_argument("--gradient-steps", type=int, default=4, help="Pasos de acumulación de gradiente.")
    parser.add_argument("--max-length", type=int, default=768, help="Longitud máxima de los ejemplos tokenizados.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    manager = TrainingManager(args.perfil)
    batch = None

    dataset_path = resolve_dataset_path(args.dataset)
    if not dataset_path:
        if args.batch_id:
            batch = manager.get_batch(args.batch_id)
            if batch is None:
                append_log(f"❌ Lote {args.batch_id} no encontrado para perfil {args.perfil}.")
                return
            dataset_path = settings.training_dir / batch.dataset_path
        else:
            batch = manager.next_ready_batch()
            if batch is None:
                append_log(f"⚠️ No hay lotes listos para {args.perfil}.")
                return
            dataset_path = settings.training_dir / batch.dataset_path
            args.batch_id = batch.batch_id

    if batch is None and args.batch_id:
        batch = manager.get_batch(args.batch_id)
    if batch and batch.status != "training":
        manager.update_status(batch.batch_id, "training")

    if not dataset_path or not dataset_path.exists():
        append_log(f"❌ Dataset no encontrado en {dataset_path}")
        if batch:
            manager.update_status(batch.batch_id, "failed", notes="Dataset no encontrado")
        return

    append_log(f"📦 Cargando dataset desde {dataset_path}")
    registros = read_jsonl(dataset_path)
    if not registros:
        append_log("❌ El dataset está vacío o es ilegible.")
        if batch:
            manager.update_status(batch.batch_id, "failed", notes="Dataset vacío")
        return

    dataset = Dataset.from_list(registros)
    base_model = args.base_model
    append_log(f"🔧 Preparando modelo base {base_model}")

    bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype="float16")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(base_model, quantization_config=bnb_config)
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.1,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)

    def tokenize(batch_row: dict) -> dict:
        texto = format_example(batch_row)
        return tokenizer(
            texto,
            truncation=True,
            padding="max_length",
            max_length=args.max_length,
        )

    append_log("🧮 Tokenizando ejemplos...")
    tokenized_dataset = dataset.map(tokenize, remove_columns=dataset.column_names)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    if args.output_name:
        model_folder = args.output_name
    elif batch:
        model_folder = batch.batch_id
    else:
        model_folder = f"{args.perfil}_batch_{timestamp}"

    output_dir = settings.base_dir / "modelos_lora" / args.perfil / model_folder
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        per_device_train_batch_size=args.per_device_batch,
        gradient_accumulation_steps=args.gradient_steps,
        learning_rate=args.learning_rate,
        logging_steps=10,
        num_train_epochs=args.epochs,
        save_strategy="epoch",
        save_total_limit=2,
        report_to="none",
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        tokenizer=tokenizer,
    )

    append_log("🚀 Iniciando entrenamiento LoRA...")
    try:
        trainer.train()
    except Exception as exc:
        append_log(f"❌ Error durante el entrenamiento: {exc}")
        if batch:
            manager.update_status(batch.batch_id, "failed", notes=str(exc))
        raise

    append_log("💾 Guardando adaptador...")
    model.save_pretrained(str(output_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(output_dir))

    safetensors_path = output_dir / "adapter_model.safetensors"
    model_rel = str(output_dir.relative_to(settings.base_dir))
    safetensors_rel = str(safetensors_path.relative_to(settings.base_dir)) if safetensors_path.exists() else None

    modelfile_path = output_dir / "Modelfile"
    modelfile_path.write_text(
        "FROM mistral\n"
        "ADAPTER ./adapter_model.safetensors\n",
        encoding="utf-8",
    )

    try:
        dataset_rel = str(dataset_path.relative_to(settings.base_dir))
    except ValueError:
        dataset_rel = str(dataset_path)

    metadata = {
        "perfil": args.perfil,
        "batch_id": batch.batch_id if batch else args.batch_id,
        "dataset_path": dataset_rel,
        "base_model": args.base_model,
        "epochs": args.epochs,
        "learning_rate": args.learning_rate,
        "per_device_batch": args.per_device_batch,
        "gradient_steps": args.gradient_steps,
        "max_length": args.max_length,
        "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "example_count": len(registros),
        "model_dir": model_rel,
        "safetensors": safetensors_rel,
    }
    metadata_path = output_dir / "training_metadata.json"
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    append_log(f"✅ Adaptador guardado en {output_dir}")

    if batch:
        manager.update_status(
            batch.batch_id,
            "completed",
            model_dir=model_rel,
            safetensors_path=safetensors_rel,
        )
    else:
        append_log("ℹ️ Entrenamiento completado fuera del pipeline automático.")


if __name__ == "__main__":
    main()
