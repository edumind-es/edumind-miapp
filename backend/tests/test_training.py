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


@pytest.mark.parametrize(
    "path",
    [
        "/training/jobs",
        "/training/queue/stats",
        "/training/models",
        "/training/models/latest",
        "/training/logs/1",
    ],
)
def test_training_read_endpoints_require_auth(client, api_v1_prefix, path):
    response = client.get(f"{api_v1_prefix}{path}")

    assert response.status_code == 401


def test_training_prepare_requires_auth(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/training/prepare",
        json={"verified_only": True, "major_version": False},
    )

    assert response.status_code == 401


def test_training_start_requires_auth(client, api_v1_prefix):
    response = client.post(
        f"{api_v1_prefix}/training/start/1",
        json={
            "job_id": 1,
            "epochs": 3,
            "learning_rate": 0.0002,
            "base_model": "mistralai/Mistral-7B-v0.1",
        },
    )

    assert response.status_code == 401
