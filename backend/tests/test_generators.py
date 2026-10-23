#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

import pytest
from sqlmodel import Session, func, select

from app.core.queue_manager import QueueStatus
from app.db import engine
from app.models import TrainingItem
from app.services.metrics_service import metrics


GENERATOR_ENDPOINTS = [
    "/planning",
    "/situation",
    "/project",
    "/stem",
    "/diversity",
    "/session",
    "/topic",
    "/case",
    "/defense",
    "/idea",
    "/minutes",
    "/institution_doc",
    "/inspection_report",
    "/reinforcement_plan",
    "/rubrics",
    "/worksheets",
    "/methodology",
    "/organization",
    "/questions",
    "/normativa",
]


def _generation_outcome_count(name: str) -> int:
    return int(metrics.get_metrics().get("generators", {}).get("outcomes_total", {}).get(name, 0))


def _generation_provider_count(provider: str) -> int:
    return int(metrics.get_metrics().get("generators", {}).get("by_provider", {}).get(provider, 0))


@pytest.mark.parametrize("endpoint", GENERATOR_ENDPOINTS)
def test_generators_reject_empty_payload(client, api_v1_prefix, endpoint):
    response = client.post(f"{api_v1_prefix}/generators{endpoint}", json={})

    assert response.status_code == 422


def test_generators_reject_unsupported_provider(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Comprender fundamentos básicos",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "invalid-provider",
        },
    )

    assert response.status_code == 400


def test_generators_public_provider_without_api_key_returns_402(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Comprender fundamentos básicos",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "chatgpt",
        },
    )

    assert response.status_code == 402


def test_generators_missing_byok_key_does_not_reserve_queue_slot(client, api_v1_prefix, monkeypatch):
    reserve_calls = 0

    async def _reserve_slot(*_args, **_kwargs):
        nonlocal reserve_calls
        reserve_calls += 1
        return QueueStatus(
            is_active=True,
            position=0,
            estimated_wait_seconds=0,
            message="Connected",
            backend="memory",
        )

    monkeypatch.setattr("app.api.v1.generators.queue_manager.reserve_slot", _reserve_slot)

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto interdisciplinar",
            "descripcion": "Descripcion",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "chatgpt",
        },
    )

    assert response.status_code == 402
    assert reserve_calls == 0


def test_generators_managed_provider_does_not_require_byok_key(client, api_v1_prefix):
    very_large_objective = "a" * 12000
    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": very_large_objective,
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "edumind",
        },
    )

    assert response.status_code in {413, 429, 503}
    assert response.status_code != 402
    assert response.status_code != 403


def test_generators_render_endpoint_returns_prompt_contract(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/render/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Comprender fundamentos básicos",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "edumind",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["tool"] == "planning"
    assert payload["prompt_id"] == "planning.didactic"
    assert payload["prompt_version"] == "2.0.0"
    assert payload["local_prompt_mode"] == "safe_client_template_v1"
    assert payload["sanitized_payload"]["curso"] == "3º ESO"
    assert "prompt_text" not in payload
    assert "provider" not in payload["sanitized_payload"]
    assert "api_key" not in payload["sanitized_payload"]


def test_generators_render_endpoint_supports_json_for_high_risk_tools(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/render/normativa",
        json={
            "consulta": "¿Qué indica la normativa?",
            "contexto": "Ley 4/2011",
            "response_format": "json",
            "provider": "edumind",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["tool"] == "normativa"
    assert payload["response_format"] == "json"
    assert payload["output_schema"] is not None


def test_generators_render_endpoint_rejects_placeholder_payload(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/render/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "No especificado",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "edumind",
        },
    )

    assert response.status_code == 422
    assert "faltan datos obligatorios" in response.text.lower()


def test_generators_render_endpoint_defaults_to_json_for_inspection_report(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/render/inspection_report",
        json={
            "tipo_documento": "informe_tecnico",
            "ambito": "Convivencia",
            "demanda_inspeccion": "Revisión de protocolo y medidas adoptadas.",
            "hallazgos": "Existen incidencias reiteradas en los recreos.",
            "actuaciones_previas": "Reuniones con tutoría y equipo directivo.",
            "evidencias": "Actas, partes y comunicaciones con familias.",
            "plazo_respuesta": "10 días hábiles",
            "normativa_aplicable": "Ley 4/2011 y Decreto 8/2015.",
            "provider": "edumind",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["response_format"] == "json"
    assert payload["output_schema"] is not None
    assert payload["output_schema"]["properties"]["requiere_revision_humana"]["type"] == "boolean"


def test_generators_generation_endpoint_rejects_placeholder_payload(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/inspection_report",
        json={
            "tipo_documento": "informe_tecnico",
            "ambito": "Convivencia",
            "demanda_inspeccion": "Pendiente",
            "hallazgos": "No especificado",
            "actuaciones_previas": "Seguimiento inicial",
            "evidencias": "Actas del centro",
            "plazo_respuesta": "10 días hábiles",
            "normativa_aplicable": "Ley 4/2011",
            "provider": "edumind",
        },
    )

    assert response.status_code == 422
    assert "faltan datos obligatorios" in response.text.lower()


def test_generators_empty_provider_stream_returns_explicit_error(client, api_v1_prefix, monkeypatch):
    async def _empty_stream_chat(*_args, **_kwargs):
        if False:  # pragma: no cover
            yield ""

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_empty_stream_chat),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto de ejemplo",
            "descripcion": "Descripción",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "Error: El proveedor no devolvió contenido útil." in response.text


def test_generators_accept_legacy_api_key_alias(client, api_v1_prefix, monkeypatch):
    async def _mock_stream_chat(*_args, **_kwargs):
        yield "Contenido de prueba"

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_mock_stream_chat),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Objetivo",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "chatgpt",
            "apiKey": "legacy-camel-case-key",
        },
    )

    assert response.status_code == 200
    assert "Contenido de prueba" in response.text


def test_generators_validates_and_pretty_prints_structured_output(client, api_v1_prefix, monkeypatch):
    async def _structured_stream(*_args, **_kwargs):
        yield "```json\n"
        yield '{"respuesta":"Aplica medidas educativas inmediatas.","evidencias":[{"norma":"Ley 4/2011","articulo":"art. 19","razon":"Establece medidas y protocolo."}],"nivel_confianza":0.91,"requiere_revision_humana":false}\n'
        yield "```"

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_structured_stream),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/normativa",
        json={
            "consulta": "¿Qué procede ante una situación grave de convivencia?",
            "contexto": "Ley 4/2011 de convivencia y protocolo autonómico aplicable.",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert '"requiere_revision_humana": false' in response.text
    assert "```" not in response.text


def test_generators_reject_invalid_structured_output(client, api_v1_prefix, monkeypatch):
    async def _invalid_structured_stream(*_args, **_kwargs):
        yield '{"respuesta":"Texto sin evidencias ni banderas suficientes"}'

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_invalid_structured_stream),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/normativa",
        json={
            "consulta": "¿Qué norma aplica?",
            "contexto": "Ley 4/2011 y documentación asociada.",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "estructura no publicable" in response.text.lower()


def test_generators_returns_network_error_diagnostic_for_gemini(client, api_v1_prefix, monkeypatch):
    async def _network_failure(*_args, **_kwargs):
        if False:  # pragma: no cover
            yield ""
        raise RuntimeError("Temporary failure in name resolution")

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_network_failure),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Objetivo",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "gemini",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "conectividad DNS/red" in response.text


def test_generators_records_success_outcome_metrics(client, api_v1_prefix, monkeypatch):
    async def _ok_stream(*_args, **_kwargs):
        yield "Contenido correcto"

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_ok_stream),
    )

    before_success = _generation_outcome_count("success")
    before_provider = _generation_provider_count("chatgpt")

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto",
            "descripcion": "Descripcion",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "Contenido correcto" in response.text
    assert _generation_outcome_count("success") == before_success + 1
    assert _generation_provider_count("chatgpt") == before_provider + 1


def test_generators_records_empty_outcome_metrics(client, api_v1_prefix, monkeypatch):
    async def _empty_stream(*_args, **_kwargs):
        if False:  # pragma: no cover
            yield ""

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_empty_stream),
    )

    before_empty = _generation_outcome_count("empty")

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto",
            "descripcion": "Descripcion",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "no devolvió contenido útil" in response.text
    assert _generation_outcome_count("empty") == before_empty + 1


def test_generators_filters_control_tokens_and_reports_empty(client, api_v1_prefix, monkeypatch):
    async def _control_tokens_only(*_args, **_kwargs):
        yield "<|im_sep|>"
        yield "<|im_sep|>"

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_control_tokens_only),
    )

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto",
            "descripcion": "Descripcion",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "no devolvió contenido útil" in response.text


def test_generators_records_dns_error_outcome_metrics(client, api_v1_prefix, monkeypatch):
    async def _dns_failure(*_args, **_kwargs):
        if False:  # pragma: no cover
            yield ""
        raise RuntimeError("Temporary failure in name resolution")

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_dns_failure),
    )

    before_dns = _generation_outcome_count("dns_error")

    response = client.post(
        f"{api_v1_prefix}/generators/idea",
        json={
            "consulta": "Genera una idea didáctica en EF",
            "provider": "gemini",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "conectividad DNS/red" in response.text
    assert _generation_outcome_count("dns_error") == before_dns + 1


def test_generators_records_timeout_outcome_metrics(client, api_v1_prefix, monkeypatch):
    async def _timeout_failure(*_args, **_kwargs):
        if False:  # pragma: no cover
            yield ""
        raise RuntimeError("Read timeout from upstream provider")

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_timeout_failure),
    )

    before_timeout = _generation_outcome_count("timeout")

    response = client.post(
        f"{api_v1_prefix}/generators/project",
        json={
            "nombre_proyecto": "Proyecto",
            "descripcion": "Descripcion",
            "objetivos": "Objetivos",
            "materiales": "Materiales",
            "provider": "gemini",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "No se pudo completar la generación" in response.text or "conectividad DNS/red" in response.text
    assert _generation_outcome_count("timeout") == before_timeout + 1


def test_generators_do_not_autosave_dataset_on_success(client, api_v1_prefix, monkeypatch):
    async def _ok_stream(*_args, **_kwargs):
        yield "Contenido que no debe persistirse automáticamente."

    monkeypatch.setattr(
        "app.api.v1.generators.AIService.stream_chat",
        staticmethod(_ok_stream),
    )

    with Session(engine) as session:
        before_total = session.exec(select(func.count(TrainingItem.id))).one()

    response = client.post(
        f"{api_v1_prefix}/generators/idea",
        json={
            "consulta": "Genera una idea breve para EF en Primaria",
            "provider": "chatgpt",
            "api_key": "byok-test-key",
        },
    )

    assert response.status_code == 200
    assert "Contenido que no debe persistirse" in response.text

    with Session(engine) as session:
        after_total = session.exec(select(func.count(TrainingItem.id))).one()
    assert after_total == before_total


def test_generators_contribution_endpoint_saves_opt_in_item(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/contribute",
        json={
            "instruction": "Planificación didáctica (contribución voluntaria)",
            "output": "Contenido pedagógico extenso válido para revisión manual en dataset." * 4,
            "tool": "planning",
            "provider": "edumind",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    item_id = payload["id"]

    with Session(engine) as session:
        item = session.get(TrainingItem, item_id)
        assert item is not None
        assert item.is_verified is False
        session.delete(item)
        session.commit()


def test_generators_contribution_endpoint_rejects_short_payload(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/generators/contribute",
        json={
            "output": "corto",
            "tool": "planning",
        },
    )

    assert response.status_code == 422


def test_generators_managed_provider_is_blocked_when_runtime_reliability_is_unhealthy(
    client, api_v1_prefix, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.generators.load_observability_alert_policy",
        lambda _session: {
            "dns_error_count": 1,
            "timeout_count": 2,
            "failure_rate_percent": 20.0,
            "min_sample_size": 10,
        },
    )
    monkeypatch.setattr(
        "app.api.v1.generators.build_provider_reliability",
        lambda _metrics, _policy: {
            "edumind": {
                "status": "unhealthy",
                "available": False,
                "reason": "Conectividad DNS/red degradada.",
                "flags": ["dns_error_spike"],
            }
        },
    )

    response = client.post(
        f"{api_v1_prefix}/generators/idea",
        json={
            "consulta": "Genera una idea didáctica",
            "provider": "edumind",
        },
    )

    assert response.status_code == 503
    assert "deshabilitado" in response.text.lower()
    assert "webgpu" in (response.headers.get("X-EDUMIND-FALLBACK") or "").lower()


def test_generators_managed_provider_is_blocked_when_forced_disabled_by_guard(
    client, api_v1_prefix, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.generators.load_observability_alert_policy",
        lambda _session: {
            "dns_error_count": 1,
            "timeout_count": 2,
            "failure_rate_percent": 20.0,
            "min_sample_size": 10,
        },
    )
    monkeypatch.setattr(
        "app.api.v1.generators.load_provider_guard_overrides",
        lambda _session: {
            "edumind": {
                "force_disabled": True,
                "reason": "Mantenimiento programado",
            }
        },
    )
    monkeypatch.setattr(
        "app.api.v1.generators.build_provider_reliability",
        lambda _metrics, _policy: {
            "edumind": {
                "status": "healthy",
                "available": True,
                "reason": "",
                "flags": [],
            }
        },
    )

    response = client.post(
        f"{api_v1_prefix}/generators/planning",
        json={
            "curso": "3º ESO",
            "horas": 3,
            "objetivo": "Objetivo",
            "metodologia_tipo": "Intermedia",
            "metodologia_texto": "Individual",
            "provider": "edumind",
        },
    )

    assert response.status_code == 503
    assert "mantenimiento programado" in response.text.lower()
    assert "webgpu" in (response.headers.get("X-EDUMIND-FALLBACK") or "").lower()
