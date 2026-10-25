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
Servicio de matrices curriculares LOMLOE (todas las comunidades, etapas y áreas).

Carga en memoria el índice generado por scripts/importar_matrices_idoceo.py y ofrece:
  - catálogo navegable (comunidad → etapa → área → nivel)
  - detalle de una matriz (competencias específicas, criterios, saberes, perfil de salida)
  - búsqueda de texto en criterios y saberes
  - bloque de contexto curricular listo para inyectar en los prompts de los generadores
"""

from __future__ import annotations

import gzip
import json
import logging
import re
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

TIPOS_BUSQUEDA = {"competencias_especificas", "criterios", "saberes"}
ETIQUETAS_TIPO = {
    "competencias_especificas": "Competencia específica",
    "criterios": "Criterio de evaluación",
    "saberes": "Saber básico",
}


def _plegar(texto: str) -> str:
    """Minúsculas sin acentos, para comparar texto de forma tolerante."""
    base = unicodedata.normalize("NFKD", texto or "")
    base = "".join(ch for ch in base if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", base.lower()).strip()


def _codigos(valores: list[str] | None) -> set[str]:
    return {str(v).strip().upper() for v in (valores or []) if str(v).strip()}


class CurriculumMatrixService:
    """Acceso en memoria al índice de matrices curriculares."""

    _lock = threading.Lock()
    _index: dict[str, Any] | None = None
    _by_id: dict[str, dict[str, Any]] = {}
    _loaded_at: str | None = None
    _last_error: str | None = None

    # ------------------------------------------------------------------ carga
    @classmethod
    def index_path(cls) -> Path:
        return Path(settings.CURRICULUM_INDEX_PATH)

    @classmethod
    def reset(cls) -> None:
        """Descarta el índice cargado (útil en tests y tras reimportar)."""
        with cls._lock:
            cls._index = None
            cls._by_id = {}
            cls._loaded_at = None
            cls._last_error = None

    @classmethod
    def load(cls, force: bool = False) -> bool:
        if cls._index is not None and not force:
            return True
        with cls._lock:
            if cls._index is not None and not force:
                return True
            ruta = cls.index_path()
            try:
                with gzip.open(ruta, "rt", encoding="utf-8") as handle:
                    index = json.load(handle)
                matrices = index.get("matrices") or []
                cls._by_id = {m["id"]: m for m in matrices}
                cls._index = index
                cls._loaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
                cls._last_error = None
                logger.info("Índice curricular cargado: %s matrices desde %s", len(matrices), ruta)
                return True
            except FileNotFoundError:
                cls._last_error = f"No existe el índice curricular en {ruta}. Ejecuta scripts/importar_matrices_idoceo.py"
            except Exception as exc:  # noqa: BLE001
                cls._last_error = f"No se pudo cargar el índice curricular: {exc}"
            logger.warning(cls._last_error)
            cls._index = None
            cls._by_id = {}
            return False

    @classmethod
    def _matrices(cls) -> list[dict[str, Any]]:
        cls.load()
        return (cls._index or {}).get("matrices") or []

    # ----------------------------------------------------------------- estado
    @classmethod
    def get_status(cls) -> dict[str, Any]:
        cargado = cls.load()
        matrices = cls._matrices()
        return {
            "loaded": cargado,
            "index_path": str(cls.index_path()),
            "loaded_at": cls._loaded_at,
            "generated_at": (cls._index or {}).get("generado"),
            "version": (cls._index or {}).get("version"),
            "matrices": len(matrices),
            "comunidades": len({m["comunidad_key"] for m in matrices}),
            "criterios": sum(len(m.get("criterios") or []) for m in matrices),
            "saberes": sum(len(m.get("saberes") or []) for m in matrices),
            "last_error": cls._last_error,
        }

    # --------------------------------------------------------------- catálogo
    @staticmethod
    def resumen(matriz: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": matriz["id"],
            "comunidad": matriz["comunidad"],
            "comunidad_key": matriz["comunidad_key"],
            "etapa": matriz["etapa"],
            "etapa_key": matriz["etapa_key"],
            "area": matriz["area"],
            "area_key": matriz["area_key"],
            "nivel": matriz["nivel"],
            "nivel_key": matriz["nivel_key"],
            "idioma": matriz["idioma"],
            "revisar": bool(matriz.get("revisar")),
            "n_competencias": len(matriz.get("competencias_especificas") or []),
            "n_criterios": len(matriz.get("criterios") or []),
            "n_saberes": len(matriz.get("saberes") or []),
        }

    @classmethod
    def list_matrices(
        cls,
        comunidad: str | None = None,
        etapa: str | None = None,
        area: str | None = None,
        incluir_revisar: bool = True,
    ) -> list[dict[str, Any]]:
        resultado = []
        for matriz in cls._matrices():
            if comunidad and matriz["comunidad_key"] != comunidad:
                continue
            if etapa and matriz["etapa_key"] != etapa:
                continue
            if area and matriz["area_key"] != area:
                continue
            if not incluir_revisar and matriz.get("revisar"):
                continue
            resultado.append(cls.resumen(matriz))
        return resultado

    @classmethod
    def get_catalogo(cls) -> dict[str, Any]:
        """Árbol comunidad → etapa → área → niveles, para selectores en el frontend."""
        comunidades: dict[str, dict[str, Any]] = {}
        for matriz in cls._matrices():
            comunidad = comunidades.setdefault(
                matriz["comunidad_key"],
                {"comunidad": matriz["comunidad"], "comunidad_key": matriz["comunidad_key"], "etapas": {}},
            )
            etapa = comunidad["etapas"].setdefault(
                matriz["etapa_key"], {"etapa": matriz["etapa"], "etapa_key": matriz["etapa_key"], "areas": {}}
            )
            area = etapa["areas"].setdefault(
                matriz["area_key"], {"area": matriz["area"], "area_key": matriz["area_key"], "niveles": []}
            )
            area["niveles"].append(
                {
                    "id": matriz["id"],
                    "nivel": matriz["nivel"],
                    "nivel_key": matriz["nivel_key"],
                    "idioma": matriz["idioma"],
                    "revisar": bool(matriz.get("revisar")),
                    "n_criterios": len(matriz.get("criterios") or []),
                    "n_saberes": len(matriz.get("saberes") or []),
                }
            )

        orden_etapas = {"infantil": 0, "primaria": 1, "secundaria": 2}
        salida = []
        for comunidad in sorted(comunidades.values(), key=lambda c: c["comunidad"]):
            etapas = []
            for etapa in sorted(comunidad["etapas"].values(), key=lambda e: orden_etapas.get(e["etapa_key"], 9)):
                areas = sorted(etapa["areas"].values(), key=lambda a: a["area"])
                etapas.append({**etapa, "areas": areas})
            salida.append({**comunidad, "etapas": etapas})
        return {"total": len(cls._matrices()), "comunidades": salida}

    # ---------------------------------------------------------------- detalle
    @classmethod
    def get_matriz(cls, matriz_id: str) -> dict[str, Any] | None:
        cls.load()
        matriz = cls._by_id.get((matriz_id or "").strip().strip("/"))
        if not matriz:
            return None
        perfil = ((cls._index or {}).get("perfiles") or {}).get(matriz.get("perfil"), {})
        detalle = {k: v for k, v in matriz.items() if k != "perfil"}
        detalle["competencias_clave"] = perfil.get("competencias_clave", [])
        detalle["descriptores"] = perfil.get("descriptores", [])
        return detalle

    # --------------------------------------------------------------- búsqueda
    @classmethod
    def search(
        cls,
        query: str,
        comunidad: str | None = None,
        etapa: str | None = None,
        area: str | None = None,
        tipo: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        tokens = [t for t in _plegar(query).split(" ") if len(t) >= 2]
        if not tokens:
            return []
        tipos = {tipo} if tipo in TIPOS_BUSQUEDA else TIPOS_BUSQUEDA
        hits: list[dict[str, Any]] = []
        for matriz in cls._matrices():
            if comunidad and matriz["comunidad_key"] != comunidad:
                continue
            if etapa and matriz["etapa_key"] != etapa:
                continue
            if area and matriz["area_key"] != area:
                continue
            for clave in tipos:
                for item in matriz.get(clave) or []:
                    texto = _plegar(item["titulo"])
                    codigo = _plegar(item.get("codigo") or "")
                    encontrados = sum(1 for t in tokens if t in texto or t == codigo)
                    if encontrados < len(tokens):
                        continue
                    puntuacion = encontrados + (2 if codigo and codigo in tokens else 0) + (0.5 if matriz.get("revisar") is False else 0)
                    hits.append(
                        {
                            "matriz_id": matriz["id"],
                            "comunidad": matriz["comunidad"],
                            "etapa": matriz["etapa"],
                            "area": matriz["area"],
                            "nivel": matriz["nivel"],
                            "tipo": clave,
                            "codigo": item.get("codigo") or "",
                            "titulo": item["titulo"],
                            "score": round(puntuacion, 2),
                        }
                    )
        hits.sort(key=lambda h: (-h["score"], h["comunidad"], h["etapa"], h["area"], h["nivel"], h["codigo"]))
        return hits[: max(1, min(limit, 100))]

    # ------------------------------------------------- contexto para prompts
    @classmethod
    def build_prompt_context(
        cls,
        matriz_id: str,
        competencias: list[str] | None = None,
        criterios: list[str] | None = None,
        saberes: list[str] | None = None,
        max_chars: int = 7000,
    ) -> str:
        """Texto plano con los elementos oficiales de la matriz (seleccionados o todos)."""
        matriz = cls.get_matriz(matriz_id)
        if not matriz:
            return ""
        sel_comp, sel_crit, sel_sab = _codigos(competencias), _codigos(criterios), _codigos(saberes)

        def filtrar(items: list[dict[str, Any]], seleccion: set[str]) -> list[dict[str, Any]]:
            if not seleccion:
                return items
            return [i for i in items if (i.get("codigo") or "").upper() in seleccion]

        comp = filtrar(matriz.get("competencias_especificas") or [], sel_comp)
        crit = filtrar(matriz.get("criterios") or [], sel_crit)
        sab = filtrar(matriz.get("saberes") or [], sel_sab)
        # Si se seleccionaron criterios pero no competencias, se muestran solo las competencias enlazadas
        if sel_crit and not sel_comp:
            enlazadas = {e.upper() for c in crit for e in (c.get("enlaces") or [])}
            comp = [c for c in comp if (c.get("codigo") or "").upper() in enlazadas] or comp
        bloques = {b["codigo"]: b["titulo"] for b in matriz.get("bloques") or []}

        lineas = [
            f"MARCO CURRICULAR OFICIAL ({matriz['comunidad']} · {matriz['etapa']} · {matriz['area']} · {matriz['nivel']}):",
            "Usa literalmente estos elementos curriculares; no inventes otros.",
        ]
        if comp:
            lineas.append("Competencias específicas:")
            lineas += [f"- {c.get('codigo') or ''}: {c['titulo']}".replace("- : ", "- ") for c in comp]
        if crit:
            lineas.append("Criterios de evaluación:")
            lineas += [
                f"- {c.get('codigo') or ''}" + (f" ({', '.join(c['enlaces'])})" if c.get("enlaces") else "") + f": {c['titulo']}"
                for c in crit
            ]
        if sab:
            lineas.append("Saberes básicos:")
            bloque_actual = None
            for s in sab:
                if s.get("bloque") != bloque_actual and s.get("bloque") in bloques:
                    bloque_actual = s["bloque"]
                    lineas.append(f"  [{bloque_actual}] {bloques[bloque_actual]}")
                lineas.append(f"- {s.get('codigo') or ''}: {s['titulo']}".replace("- : ", "- "))

        texto = "\n".join(lineas)
        if len(texto) > max_chars:
            texto = texto[: max_chars - 60].rsplit("\n", 1)[0] + "\n- (listado recortado por longitud; consulta la matriz completa)"
        return texto

    @classmethod
    def enrich_generator_payload(cls, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Si el payload trae `matriz_curricular` {id, competencias, criterios, saberes},
        añade `marco_curricular` (texto) y vuelca criterios/saberes seleccionados en los
        campos que ya usan los prompts (criterios_evaluacion, contenidos, contenidos_refuerzo).
        """
        datos = dict(payload or {})
        referencia = datos.pop("matriz_curricular", None)
        if not isinstance(referencia, dict) or not referencia.get("id"):
            return datos
        matriz = cls.get_matriz(str(referencia["id"]))
        if not matriz:
            return datos

        sel_crit = _codigos(referencia.get("criterios"))
        sel_sab = _codigos(referencia.get("saberes"))
        criterios = [c for c in matriz.get("criterios") or [] if (c.get("codigo") or "").upper() in sel_crit]
        saberes = [s for s in matriz.get("saberes") or [] if (s.get("codigo") or "").upper() in sel_sab]

        def anexar(campo: str, lineas: list[str]) -> None:
            if not lineas:
                return
            actual = datos.get(campo)
            if isinstance(actual, list):
                datos[campo] = list(dict.fromkeys([*actual, *lineas]))
            else:
                previo = str(actual or "").strip()
                datos[campo] = (previo + "\n" if previo else "") + "\n".join(lineas)

        lineas_crit = [f"{c.get('codigo') or ''} {c['titulo']}".strip() for c in criterios]
        lineas_sab = [f"{s.get('codigo') or ''} {s['titulo']}".strip() for s in saberes]
        anexar("criterios_evaluacion", lineas_crit)
        if "contenidos_refuerzo" in datos:
            anexar("contenidos_refuerzo", lineas_sab)
        else:
            anexar("contenidos", lineas_sab)

        # La comunidad autónoma se deriva de la matriz: los prompts dejan de asumir Galicia.
        datos.setdefault("comunidad", matriz.get("comunidad"))
        datos["matriz_id"] = matriz["id"]  # permite validar después los códigos que cite la salida
        datos["marco_curricular"] = cls.build_prompt_context(
            matriz["id"],
            competencias=referencia.get("competencias"),
            criterios=referencia.get("criterios"),
            saberes=referencia.get("saberes"),
        )
        datos["matriz_curricular_id"] = matriz["id"]
        return datos


    @classmethod
    def validate_cited_codes(cls, matriz_id: str, text: str) -> dict[str, list[str]]:
        """Comprueba que los códigos curriculares que cita un texto existen en la matriz.

        Se consideran candidatos los tokens con la misma familia de prefijo que los
        códigos de la matriz (p. ej. CE1.1, B2.3, OBJ4). Devuelve los citados que sí
        existen y los que no (posibles invenciones del modelo).
        """
        matriz = cls.get_matriz(matriz_id)
        if not matriz or not text:
            return {"citados": [], "desconocidos": []}
        conocidos: set[str] = set()
        for clave in ("competencias_especificas", "criterios", "saberes"):
            for item in matriz.get(clave) or []:
                codigo = (item.get("codigo") or "").strip().upper()
                if codigo:
                    conocidos.add(codigo)
        prefijos = {re.match(r"[A-Z]+", c).group(0) for c in conocidos if re.match(r"[A-Z]+", c)}
        if not prefijos:
            return {"citados": [], "desconocidos": []}
        patron = re.compile(r"\b(" + "|".join(sorted(prefijos, key=len, reverse=True)) + r")\d+(?:\.\d+){0,2}\b")
        citados: list[str] = []
        desconocidos: list[str] = []
        for m in patron.finditer(text.upper()):
            codigo = m.group(0)
            destino = citados if codigo in conocidos else desconocidos
            if codigo not in destino:
                destino.append(codigo)
        return {"citados": citados, "desconocidos": desconocidos}
