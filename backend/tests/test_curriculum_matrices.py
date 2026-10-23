#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Tests del parser iDoceo, del índice curricular y de la API /curriculum."""

from pathlib import Path

import openpyxl
import pytest

from app.core.prompt_registry import get_generator_prompt
from app.services.curriculum_matrix_parser import build_index, interpretar_nombre, nivel_orden, slugify
from app.services.curriculum_matrix_service import CurriculumMatrixService

FILAS_IDOCEO = [
    [None, "Tipo", "Código", "Enlaces", "Título", "Icono", "Color", "Peso"],
    [None, "0", "CCL", None, "CCL · Competencia en comunicación lingüística", None, None, None],
    [None, "1", "CCL1", "CCL", "Expresa hechos y opiniones de forma oral y escrita.", None, None, None],
    [None, "2", "CE1", None, "Adoptar un estilo de vida activo y saludable.", None, None, None],
    [None, "3", "CE1.1", "CE1", "Reconocer los efectos beneficiosos de la actividad física.", None, None, "1"],
    [None, "3", "CE1.2", "CE1", "Integrar el calentamiento  y la vuelta a la calma.", None, None, "1"],
    [None, "4", "B1", None, "Bloque 1. Vida activa y saludable", None, None, None],
    [None, "4", "B1.1", "CE1.1, CE1.2", "Educación postural en acciones motrices.", None, None, None],
    [None, "4", "B1.2", "CE1.1", "Juego limpio y respeto a las normas.", None, None, None],
]


def _escribir_matriz(ruta: Path) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    libro = openpyxl.Workbook()
    hoja = libro.active
    for fila in FILAS_IDOCEO:
        hoja.append(fila)
    libro.save(ruta)


@pytest.fixture
def carpeta_matrices(tmp_path: Path) -> Path:
    raiz = tmp_path / "idoceo_matrices"
    _escribir_matriz(raiz / "MADRID" / "Primaria" / "Madrid · Primaria · Educación Física · Tercer ciclo.xlsx")
    _escribir_matriz(raiz / "Galicia" / "primaria" / "iDoceo_educacion-fisica_5º.xlsx")
    _escribir_matriz(raiz / "CURRICULOS_NUEVOS" / "MADRID" / "ignorada.xlsx")
    _escribir_matriz(raiz / "Muestra_suelta.xlsx")
    return raiz


def test_slugify_unifica_ordinales():
    assert slugify("5.º") == slugify("5º") == "5o"
    assert slugify("Educación Física") == "educacion-fisica"
    assert nivel_orden("Tercer ciclo") == 30
    assert nivel_orden("5.º") == 5
    assert nivel_orden("Toda la etapa") == 0


def test_interpretar_nombre_formato_nuevo_y_galicia(carpeta_matrices: Path):
    nuevo = interpretar_nombre(
        carpeta_matrices / "MADRID" / "Primaria" / "Madrid · Primaria · Educación Física · Tercer ciclo.xlsx",
        carpeta_matrices,
    )
    assert nuevo == {
        "comunidad": "Madrid",
        "etapa": "Primaria",
        "area": "Educación Física",
        "nivel": "Tercer ciclo",
        "revisar": False,
        "idioma": "es",
        "archivo": "MADRID/Primaria/Madrid · Primaria · Educación Física · Tercer ciclo.xlsx",
    }
    galicia = interpretar_nombre(
        carpeta_matrices / "Galicia" / "primaria" / "iDoceo_educacion-fisica_5º.xlsx", carpeta_matrices
    )
    assert galicia["comunidad"] == "Galicia"
    assert galicia["etapa"] == "Primaria"
    assert galicia["area"] == "Educación Física"
    assert galicia["nivel"] == "5.º"
    assert interpretar_nombre(carpeta_matrices / "Muestra_suelta.xlsx", carpeta_matrices) is None


def test_build_index_parsea_jerarquia_idoceo(carpeta_matrices: Path):
    index, avisos = build_index(carpeta_matrices)
    ids = sorted(m["id"] for m in index["matrices"])
    assert ids == ["galicia/primaria/educacion-fisica/5o", "madrid/primaria/educacion-fisica/tercer-ciclo"]
    assert avisos == []
    matriz = next(m for m in index["matrices"] if m["comunidad_key"] == "madrid")
    assert matriz["competencias_especificas"] == [
        {"codigo": "CE1", "enlaces": [], "titulo": "Adoptar un estilo de vida activo y saludable."}
    ]
    assert [c["codigo"] for c in matriz["criterios"]] == ["CE1.1", "CE1.2"]
    assert matriz["criterios"][1]["titulo"] == "Integrar el calentamiento y la vuelta a la calma."
    assert matriz["bloques"] == [{"codigo": "B1", "titulo": "Bloque 1. Vida activa y saludable"}]
    assert matriz["saberes"][0] == {
        "codigo": "B1.1",
        "bloque": "B1",
        "enlaces": ["CE1.1", "CE1.2"],
        "titulo": "Educación postural en acciones motrices.",
    }
    # El perfil de salida (Tipo 0 y 1) se guarda una sola vez y se referencia
    assert len(index["perfiles"]) == 1
    perfil = index["perfiles"][matriz["perfil"]]
    assert perfil["competencias_clave"][0]["codigo"] == "CCL"
    assert perfil["descriptores"][0]["enlaces"] == ["CCL"]


# --- Índice real generado (backend/curriculo/matrices_idoceo.json.gz) -------------------------


def test_indice_real_cargado(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/curriculum/status")
    assert response.status_code == 200
    estado = response.json()
    assert estado["loaded"] is True, estado["last_error"]
    assert estado["matrices"] > 1000
    assert estado["comunidades"] >= 17


def test_catalogo_incluye_galicia_primaria(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/curriculum/catalogo")
    assert response.status_code == 200
    catalogo = response.json()
    galicia = next(c for c in catalogo["comunidades"] if c["comunidad_key"] == "galicia")
    primaria = next(e for e in galicia["etapas"] if e["etapa_key"] == "primaria")
    ef = next(a for a in primaria["areas"] if a["area_key"] == "educacion-fisica")
    assert [n["nivel"] for n in ef["niveles"]] == ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"]


def test_detalle_matriz_galicia_ef_quinto(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/curriculum/matrices/galicia/primaria/educacion-fisica/5o")
    assert response.status_code == 200
    matriz = response.json()
    assert matriz["area"] == "Educación Física"
    assert matriz["competencias_clave"] and matriz["descriptores"]
    assert matriz["criterios"][0]["codigo"] == "CE1.1"
    assert any(s["bloque"] == "B1" for s in matriz["saberes"])


def test_listar_y_buscar(client, api_v1_prefix):
    listado = client.get(f"{api_v1_prefix}/curriculum/matrices", params={"comunidad": "galicia", "etapa": "primaria"})
    assert listado.status_code == 200
    assert all(m["comunidad_key"] == "galicia" and m["etapa_key"] == "primaria" for m in listado.json())
    assert len(listado.json()) >= 50

    busqueda = client.get(
        f"{api_v1_prefix}/curriculum/buscar",
        params={"q": "juego limpio", "comunidad": "galicia", "tipo": "saberes", "limit": 5},
    )
    assert busqueda.status_code == 200
    payload = busqueda.json()
    assert 0 < payload["total"] <= 5
    assert all("limpio" in hit["titulo"].lower() for hit in payload["results"])

    inexistente = client.get(f"{api_v1_prefix}/curriculum/matrices/narnia/primaria/magia/1o")
    assert inexistente.status_code == 404


def test_contexto_para_prompt(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/curriculum/contexto",
        json={"id": "galicia/primaria/educacion-fisica/5o", "criterios": ["CE1.1"], "saberes": ["B1.2"]},
    )
    assert response.status_code == 200
    texto = response.json()["texto"]
    assert "MARCO CURRICULAR OFICIAL (Galicia · Primaria · Educación Física · 5.º)" in texto
    assert "CE1.1" in texto and "B1.2" in texto
    assert "CE2.1" not in texto


def test_generadores_inyectan_marco_curricular():
    payload = {
        "area_educativa": "Educación Física",
        "curso": "5º",
        "etapa_educativa": "Primaria",
        "fecha_inicio_refuerzo": "2026-10-01",
        "fecha_fin_estimada": "2026-12-20",
        "contenidos_refuerzo": ["Control postural"],
        "criterios_evaluacion": "Los del área",
        "instrumentos_evaluacion": "Observación",
        "evidencias_necesidad_refuerzo": "Dificultades de coordinación",
        "forma_trabajo_aplicada": "Grupos reducidos",
        "recursos_empleados": "Material del gimnasio",
        "desarrollo_aplicado": "Dos sesiones semanales",
        "matriz_curricular": {"id": "galicia/primaria/educacion-fisica/5o", "criterios": ["CE1.1"], "saberes": ["B1.1"]},
    }
    enriquecido = CurriculumMatrixService.enrich_generator_payload(payload)
    assert "matriz_curricular" not in enriquecido
    assert enriquecido["matriz_curricular_id"] == "galicia/primaria/educacion-fisica/5o"
    assert enriquecido["contenidos_refuerzo"][0] == "Control postural"
    assert enriquecido["contenidos_refuerzo"][1].startswith("B1.1 ")
    assert "CE1.1" in enriquecido["criterios_evaluacion"]

    bundle = get_generator_prompt("reinforcement_plan", enriquecido)
    assert "MARCO CURRICULAR OFICIAL (Galicia · Primaria · Educación Física · 5.º)" in bundle.prompt_text

    situacion = CurriculumMatrixService.enrich_generator_payload(
        {
            "curso": "5º",
            "etapa_educativa": "Primaria",
            "modelo_pedagogico": "ABP",
            "tipo_tarea": "Reto",
            "estilo_ensenanza": "Descubrimiento guiado",
            "contenidos": "",
            "objetivos": "Mejorar la condición física",
            "criterios_evaluacion": "",
            "casos_neae": "Ninguno",
            "temporalizacion": "4",
            "tipo_temporalizacion": "semanas",
            "matriz_curricular": {"id": "galicia/primaria/educacion-fisica/5o", "criterios": ["CE1.2"], "saberes": ["B1.2"]},
        }
    )
    assert situacion["contenidos"].startswith("B1.2 ")
    assert situacion["criterios_evaluacion"].startswith("CE1.2 ")
    bundle = get_generator_prompt("situation", situacion)
    assert "MARCO CURRICULAR OFICIAL" in bundle.prompt_text

    # Sin referencia, el payload se devuelve intacto
    assert CurriculumMatrixService.enrich_generator_payload({"curso": "5º"}) == {"curso": "5º"}
