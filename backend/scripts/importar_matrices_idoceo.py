#!/usr/bin/env python3
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""
Importa las matrices curriculares iDoceo publicadas en edumind_content y genera
el índice comprimido que consume MiApp (backend/curriculo/matrices_idoceo.json.gz).

Lee únicamente las carpetas publicadas por territorio (las que sirve el atlas),
ignorando CURRICULOS_NUEVOS (fuente de trabajo), herramientas y pruebas.

Uso:
    python scripts/importar_matrices_idoceo.py [--source RUTA] [--output RUTA] [--dry-run]

Es idempotente: se puede volver a ejecutar cada vez que se actualicen las matrices.
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from pathlib import Path

# Permite importar app.* ejecutando el script desde backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.curriculum_matrix_parser import (  # noqa: E402
    INDEX_VERSION,
    build_index,
)

DEFAULT_SOURCE = Path("/var/www/edumind_content/idoceo_matrices")
DEFAULT_OUTPUT = BACKEND_DIR / "curriculo" / "matrices_idoceo.json.gz"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Carpeta idoceo_matrices publicada")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Índice .json.gz de salida")
    parser.add_argument("--dry-run", action="store_true", help="Solo informa, no escribe el índice")
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"ERROR: no existe la carpeta de origen {args.source}", file=sys.stderr)
        return 1

    started = time.time()
    index, warnings = build_index(args.source)
    matrices = index["matrices"]

    # Resumen por territorio y etapa
    resumen: dict[str, dict[str, int]] = {}
    for matriz in matrices:
        resumen.setdefault(matriz["comunidad"], {}).setdefault(matriz["etapa"], 0)
        resumen[matriz["comunidad"]][matriz["etapa"]] += 1

    print(f"Índice v{INDEX_VERSION} · {len(matrices)} matrices · {round(time.time() - started, 1)} s")
    for comunidad in sorted(resumen):
        etapas = " · ".join(f"{etapa}: {n}" for etapa, n in sorted(resumen[comunidad].items()))
        print(f"  {comunidad:<22} {etapas}")
    total_items = sum(
        len(m["competencias_especificas"]) + len(m["criterios"]) + len(m["saberes"]) for m in matrices
    )
    print(f"Elementos curriculares propios: {total_items} · perfiles de salida distintos: {len(index['perfiles'])}")
    if warnings:
        print(f"Avisos ({len(warnings)}):")
        for warning in warnings[:40]:
            print(f"  - {warning}")
        if len(warnings) > 40:
            print(f"  ... y {len(warnings) - 40} más")

    if args.dry_run:
        print("Dry-run: no se escribe el índice.")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(index, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(args.output, "wb", compresslevel=9) as handle:
        handle.write(payload)
    print(f"Escrito {args.output} ({round(args.output.stat().st_size / 1024 / 1024, 2)} MB comprimido, "
          f"{round(len(payload) / 1024 / 1024, 2)} MB sin comprimir)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
