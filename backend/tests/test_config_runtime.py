#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#


def test_config_engines_exposes_managed_and_byok_metadata(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/config/engines")
    assert response.status_code == 200

    engines = response.json()
    assert isinstance(engines, list)
    assert any(engine["id"] == "edumind" for engine in engines)
    assert any(engine["id"] == "chatgpt" for engine in engines)

    chatgpt = next(engine for engine in engines if engine["id"] == "chatgpt")
    assert chatgpt["requires_api_key"] is True


def test_config_runtime_policy_requires_admin_or_vpn(client, api_v1_prefix):
    response = client.get(f"{api_v1_prefix}/config/runtime-policy")
    assert response.status_code == 403
