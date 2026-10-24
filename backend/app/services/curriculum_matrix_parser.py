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
Parser de matrices curriculares en formato iDoceo (xlsx de 8 columnas).

Jerarquía de la columna Tipo:
    0 · competencias clave
    1 · descriptores operativos del perfil de salida
    2 · competencias específicas (en Galicia aparecen como objetivos OBJn)
    3 · criterios de evaluación
    4 · saberes básicos (cabeceras de bloque Bn + saberes Bn.m)

Convierte cada xlsx en un diccionario normalizado, independiente del territorio
y del idioma de las cabeceras (castellano o catalán).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import openpyxl

INDEX_VERSION = 1

# Carpetas de idoceo_matrices que NO son matrices publicadas
CARPETAS_IGNORADAS = {
    "CURRICULOS_NUEVOS",
    "_idoceo_tools",
    "_test_nombres_iDoceo",
    "dl_service",
    "__pycache__",
    "_backups",
    "RealesDecretos",
}

# Cabeceras aceptadas (castellano / catalán) → clave interna
CABECERAS = {
    "tipo": {"tipo", "tipus"},
    "codigo": {"código", "codigo", "codi"},
    "enlaces": {"enlaces", "enllaços", "enllacos"},
    "titulo": {"título", "titulo", "títol", "titol"},
    "peso": {"peso", "pes"},
}

# Nombres de área para el formato antiguo de Galicia (iDoceo_<area>_<nivel>.xlsx)
AREAS_GALICIA = {
    "ciencias-naturales": "Ciencias de la Naturaleza",
    "ciencias-sociales": "Ciencias Sociales",
    "educacion-fisica": "Educación Física",
    "lengua-castellana": "Lengua Castellana y Literatura",
    "lengua-castellana-y-literatura": "Lengua Castellana y Literatura",
    "lengua-extranjera": "Lengua Extranjera",
    "segunda-lengua-extranjera": "Segunda Lengua Extranjera",
    "lingua-galega": "Lingua Galega e Literatura",
    "lengua-gallega-y-literatura": "Lingua Galega e Literatura",
    "matematicas": "Matemáticas",
    "musica-danza": "Música y Danza",
    "musica": "Música",
    "plastica-visual": "Educación Plástica y Visual",
    "educacion-plastica-visual-y-audiovisual": "Educación Plástica, Visual y Audiovisual",
    "valores-civicos-y-eticos": "Educación en Valores Cívicos y Éticos",
    "educacion-en-valores-civicos-y-eticos": "Educación en Valores Cívicos y Éticos",
    "biologia-y-geologia": "Biología y Geología",
    "fisica-y-quimica": "Física y Química",
    "geografia-y-historia": "Geografía e Historia",
    "tecnologia": "Tecnología",
    "tecnologia-y-digitalizacion": "Tecnología y Digitalización",
    "digitalizacion": "Digitalización",
    "latin": "Latín",
    "economia-y-emprendimiento": "Economía y Emprendimiento",
    "expresion-artistica": "Expresión Artística",
    "ambito-linguistico-y-social": "Ámbito Lingüístico y Social",
    "ambito-cientifico-tecnologico": "Ámbito Científico-Tecnológico",
}

ETAPAS = {
    "infantil": "Infantil",
    "primaria": "Primaria",
    "secundaria": "Secundaria",
    "eso": "Secundaria",
}


def slugify(texto: str) -> str:
    """Pliega acentos y deja solo [a-z0-9-]."""
    base = (texto or "").replace(".º", "º").replace(".ª", "ª").replace("º", "o").replace("ª", "a")
    base = unicodedata.normalize("NFKD", base)
    base = "".join(ch for ch in base if not unicodedata.combining(ch))
    base = re.sub(r"[^a-z0-9]+", "-", base.lower())
    return base.strip("-")


def normalizar_texto(valor: Any) -> str:
    if valor is None:
        return ""
    texto = str(valor).replace("\xa0", " ")
    return re.sub(r"\s+", " ", texto).strip()


def _separar_enlaces(valor: Any) -> list[str]:
    texto = normalizar_texto(valor)
    if not texto:
        return []
    return [parte.strip() for parte in re.split(r"[,;]", texto) if parte.strip()]


def _normalizar_etapa(texto: str) -> str:
    clave = slugify(texto)
    for patron, etapa in ETAPAS.items():
        if patron in clave:
            return etapa
    return texto.strip().title() or "Sin etapa"


def nivel_orden(nivel: str) -> int:
    """Orden aproximado para presentar niveles: ciclos ×10, cursos ×1, etapa completa 0."""
    clave = slugify(nivel)
    if not clave or "toda-la-etapa" in clave or "tota-l-etapa" in clave or "todos" in clave:
        return 0
    ordinales = {
        "primer": 1, "primero": 1, "1": 1, "1r": 1, "1er": 1, "inicial": 1,
        "segon": 2, "segundo": 2, "2": 2, "2n": 2, "2o": 2, "mitj": 2, "mitja": 2,
        "tercer": 3, "tercero": 3, "3": 3, "3r": 3, "3er": 3, "superior": 3,
        "cuarto": 4, "quart": 4, "4": 4, "4t": 4,
        "quinto": 5, "5": 5, "sexto": 6, "6": 6,
    }
    numero = 0
    for token in clave.split("-"):
        if token in ordinales:
            numero = ordinales[token]
            break
        match = re.match(r"^(\d)", token)
        if match:
            numero = int(match.group(1))
            break
    if "ciclo" in clave or "cicle" in clave:
        return numero * 10
    return numero


def _nivel_galicia(sufijo: str) -> str:
    """Convierte el sufijo del nombre antiguo (5º, 4ºA, Todos_os_cursos) en etiqueta legible."""
    texto = sufijo.replace("_", " ").strip()
    if slugify(texto) in {"todos-os-cursos", "todos-los-cursos", "toda-la-etapa"}:
        return "Toda la etapa"
    match = re.match(r"^(\d)º\s*([AB])?$", texto)
    if match:
        return f"{match.group(1)}.º" + (f" {match.group(2)}" if match.group(2) else "")
    return texto or "Toda la etapa"


def interpretar_nombre(ruta: Path, raiz: Path) -> dict[str, Any] | None:
    """Extrae comunidad, etapa, área y nivel del nombre de archivo y de la carpeta."""
    base = ruta.stem
    relativa = ruta.relative_to(raiz)
    partes_ruta = relativa.parts
    if len(partes_ruta) < 2:
        return None  # xlsx sueltos en la raíz (muestras), no son matrices publicadas
    carpeta_comunidad = partes_ruta[0]
    carpeta_etapa = partes_ruta[1]
    revisar = bool(re.search(r"\[revisar\]|^REVISAR_", base, re.IGNORECASE))

    if " · " in base:
        # Formato nuevo: "Comunidad · Etapa · Área · Nivel"
        partes = [p.strip() for p in base.split(" · ")]
        if len(partes) < 3:
            return None
        comunidad = partes[0]
        etapa = _normalizar_etapa(partes[1])
        area = partes[2]
        nivel = " · ".join(partes[3:]).strip() or "Toda la etapa"
        nivel = re.sub(r"\s*\[revisar\]\s*", " ", nivel, flags=re.IGNORECASE).strip() or "Toda la etapa"
    else:
        # Formato antiguo (Galicia): iDoceo_<area-slug>_<nivel>
        stem = re.sub(r"^REVISAR_", "", base).removeprefix("iDoceo_")
        match = re.match(r"^(.*?)_(Todos_os_cursos|todos-los-cursos|toda-la-etapa|\d[ºo]?[AB]?)$", stem)
        if match:
            area_slug, sufijo = match.group(1), match.group(2)
        else:
            area_slug, sufijo = stem, ""
        comunidad = carpeta_comunidad
        etapa = _normalizar_etapa(carpeta_etapa)
        area = AREAS_GALICIA.get(area_slug) or area_slug.replace("-", " ").capitalize()
        nivel = _nivel_galicia(sufijo)

    if "revisar" in slugify(nivel):
        revisar = True

    idioma = "es"
    if "/val/" in f"/{relativa.as_posix()}/":
        idioma = "va"
    elif slugify(comunidad) == "galicia" and "galega" in slugify(area):
        idioma = "gl"

    return {
        "comunidad": comunidad,
        "etapa": etapa,
        "area": area,
        "nivel": nivel,
        "revisar": revisar,
        "idioma": idioma,
        "archivo": relativa.as_posix(),
    }


def _mapear_cabecera(fila: tuple) -> dict[str, int] | None:
    columnas: dict[str, int] = {}
    for indice, celda in enumerate(fila):
        nombre = normalizar_texto(celda).lower()
        for clave, aceptadas in CABECERAS.items():
            if nombre in aceptadas:
                columnas[clave] = indice
    if "tipo" not in columnas or "titulo" not in columnas:
        return None
    return columnas


def parsear_xlsx(ruta: Path) -> tuple[dict[str, list[dict[str, Any]]], str, list[str]]:
    """Devuelve (elementos por tipo, idioma detectado por cabecera, avisos)."""
    avisos: list[str] = []
    libro = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    try:
        hoja = libro.worksheets[0]
        filas = hoja.iter_rows(values_only=True)
        cabecera = next(filas, None)
    except StopIteration:
        cabecera = None
    if cabecera is None:
        libro.close()
        return {}, "es", ["hoja vacía"]
    columnas = _mapear_cabecera(cabecera)
    if columnas is None:
        libro.close()
        return {}, "es", ["cabecera no reconocida"]
    idioma_cabecera = "ca" if normalizar_texto(cabecera[columnas["tipo"]]).lower() == "tipus" else "es"

    elementos: dict[str, list[dict[str, Any]]] = {
        "competencias_clave": [],
        "descriptores": [],
        "competencias_especificas": [],
        "criterios": [],
        "bloques": [],
        "saberes": [],
    }
    bloque_actual: str | None = None

    def celda(fila: tuple, clave: str) -> Any:
        indice = columnas.get(clave)
        if indice is None or indice >= len(fila):
            return None
        return fila[indice]

    for fila in filas:
        tipo = normalizar_texto(celda(fila, "tipo"))
        if tipo not in {"0", "1", "2", "3", "4"}:
            continue
        codigo = normalizar_texto(celda(fila, "codigo"))
        titulo = normalizar_texto(celda(fila, "titulo"))
        enlaces = _separar_enlaces(celda(fila, "enlaces"))
        if not titulo:
            continue
        if tipo == "0":
            elementos["competencias_clave"].append({"codigo": codigo, "titulo": titulo})
        elif tipo == "1":
            elementos["descriptores"].append({"codigo": codigo, "enlaces": enlaces, "titulo": titulo})
        elif tipo == "2":
            elementos["competencias_especificas"].append({"codigo": codigo, "enlaces": enlaces, "titulo": titulo})
        elif tipo == "3":
            peso = normalizar_texto(celda(fila, "peso"))
            elementos["criterios"].append(
                {"codigo": codigo, "enlaces": enlaces, "titulo": titulo, "peso": peso or None}
            )
        else:
            es_bloque = bool(re.fullmatch(r"[A-Za-z]*\d+", codigo)) and not enlaces
            if es_bloque:
                bloque_actual = codigo
                elementos["bloques"].append({"codigo": codigo, "titulo": titulo})
            else:
                elementos["saberes"].append(
                    {"codigo": codigo, "bloque": bloque_actual, "enlaces": enlaces, "titulo": titulo}
                )
    libro.close()

    if not elementos["criterios"]:
        avisos.append("sin criterios (Tipo 3)")
    if not elementos["saberes"]:
        avisos.append("sin saberes (Tipo 4)")
    return elementos, idioma_cabecera, avisos


def listar_xlsx(raiz: Path) -> list[Path]:
    rutas: list[Path] = []
    for carpeta, subcarpetas, archivos in os.walk(raiz):
        subcarpetas[:] = sorted(d for d in subcarpetas if d not in CARPETAS_IGNORADAS and not d.startswith("."))
        for nombre in sorted(archivos):
            if nombre.lower().endswith(".xlsx") and not nombre.startswith("~$"):
                rutas.append(Path(carpeta) / nombre)
    return rutas


def build_index(raiz: Path) -> tuple[dict[str, Any], list[str]]:
    """Construye el índice completo a partir de la carpeta publicada."""
    matrices: list[dict[str, Any]] = []
    perfiles: dict[str, dict[str, Any]] = {}
    avisos: list[str] = []
    ids_usados: set[str] = set()

    for ruta in listar_xlsx(raiz):
        meta = interpretar_nombre(ruta, raiz)
        if meta is None:
            continue
        try:
            elementos, idioma_cabecera, avisos_archivo = parsear_xlsx(ruta)
        except Exception as exc:  # noqa: BLE001 - un archivo roto no debe parar la importación
            avisos.append(f"{meta['archivo']}: error al leer ({exc})")
            continue
        if not elementos:
            avisos.append(f"{meta['archivo']}: {'; '.join(avisos_archivo)}")
            continue
        for aviso in avisos_archivo:
            avisos.append(f"{meta['archivo']}: {aviso}")
        if idioma_cabecera == "ca" and meta["idioma"] == "es":
            meta["idioma"] = "ca"

        comunidad_key = slugify(meta["comunidad"])
        etapa_key = slugify(meta["etapa"])
        area_key = slugify(meta["area"])
        nivel_key = slugify(meta["nivel"]) or "toda-la-etapa"
        identificador = f"{comunidad_key}/{etapa_key}/{area_key}/{nivel_key}"
        sufijo = 2
        while identificador in ids_usados:
            identificador = f"{comunidad_key}/{etapa_key}/{area_key}/{nivel_key}-{sufijo}"
            sufijo += 1
        ids_usados.add(identificador)

        # Las competencias clave y los descriptores del perfil de salida se repiten en
        # cientos de matrices: se guardan una sola vez y cada matriz referencia su perfil.
        perfil = {
            "competencias_clave": elementos.pop("competencias_clave"),
            "descriptores": elementos.pop("descriptores"),
        }
        perfil_key = hashlib.sha1(
            json.dumps(perfil, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()[:12]
        perfiles.setdefault(perfil_key, perfil)

        matrices.append(
            {
                "id": identificador,
                "comunidad": meta["comunidad"],
                "comunidad_key": comunidad_key,
                "etapa": meta["etapa"],
                "etapa_key": etapa_key,
                "area": meta["area"],
                "area_key": area_key,
                "nivel": meta["nivel"],
                "nivel_key": nivel_key,
                "nivel_orden": nivel_orden(meta["nivel"]),
                "idioma": meta["idioma"],
                "revisar": meta["revisar"],
                "archivo": meta["archivo"],
                "perfil": perfil_key,
                **elementos,
            }
        )

    matrices.sort(key=lambda m: (m["comunidad"], m["etapa"], m["area"], m["nivel_orden"], m["nivel"]))
    index = {
        "version": INDEX_VERSION,
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "fuente": str(raiz),
        "licencia": "© Luis Vilela Acuña · EDUmind® · CC BY-SA 4.0",
        "perfiles": perfiles,
        "matrices": matrices,
    }
    return index, avisos
