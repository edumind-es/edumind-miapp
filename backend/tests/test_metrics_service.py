#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from app.services.metrics_service import (
    MAX_NAVIGATION_PATH_SERIES,
    MetricsCollector,
    classify_user_agent_family,
    mask_ip_address,
    normalize_endpoint_label,
    normalize_navigation_path,
    normalize_reason_label,
    normalize_referrer_label,
)


def test_metrics_helpers_normalize_routes_and_referrers():
    assert normalize_endpoint_label("/api/v1/resources/123/download") == "/api/v1/resources/:id/download"
    assert normalize_navigation_path("/planner/2026/abril?view=month#top") == "/planner/:id/abril?query#fragment"
    assert normalize_referrer_label("https://miapp.edumind.es/class/55?tab=notes") == "https://miapp.edumind.es/class/:id"
    assert normalize_reason_label("Queue Full / Retry Later") == "queue_full_retry_later"


def test_metrics_helpers_mask_pii_and_user_agent_family():
    assert mask_ip_address("192.168.1.42") == "192.168.1.x"
    assert mask_ip_address("2001:0db8:85a3:0000:0000:8a2e:0370:7334") == "2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx"
    assert classify_user_agent_family("Mozilla/5.0 Chrome/122.0.0.0 Safari/537.36") == "chrome"


def test_metrics_collector_caps_navigation_cardinality():
    collector = MetricsCollector()
    collector.invalid_navigation_by_path.clear()
    collector.cardinality_overflow_counts["navigation_path"] = 0

    for index in range(MAX_NAVIGATION_PATH_SERIES + 5):
        collector.record_invalid_navigation(f"/ruta-especifica-{index}/detalle-{index}")

    assert "__other__" in collector.invalid_navigation_by_path
    assert collector.cardinality_overflow_counts["navigation_path"] > 0
