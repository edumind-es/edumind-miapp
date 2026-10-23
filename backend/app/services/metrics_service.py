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
Metrics Service - Application metrics for monitoring.
Provides Prometheus-compatible metrics and internal statistics.
"""
import time
import re
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, Any, Optional
from collections import defaultdict
import threading
from urllib.parse import urlsplit

MAX_REQUEST_ENDPOINT_SERIES = 64
MAX_NAVIGATION_PATH_SERIES = 64
MAX_REFERRER_SERIES = 32
MAX_ADMISSION_REASON_SERIES = 24
OVERFLOW_LABEL = "__other__"
UNKNOWN_LABEL = "unknown"


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_route_segment(segment: str) -> str:
    raw_segment = _normalize_whitespace(segment).lower()
    if not raw_segment:
        return ""
    if re.fullmatch(r"\d+", raw_segment):
        return ":id"
    if re.fullmatch(r"[0-9a-f]{8,}", raw_segment) or re.fullmatch(r"[0-9a-f-]{12,}", raw_segment):
        return ":token"
    if "@" in raw_segment:
        return ":email"
    if len(raw_segment) > 48:
        return ":slug"
    return re.sub(r"[^a-z0-9._:-]+", "-", raw_segment).strip("-") or ":value"


def normalize_endpoint_label(endpoint: str) -> str:
    parsed = urlsplit(endpoint or "/")
    path = parsed.path or "/"
    segments = [_normalize_route_segment(segment) for segment in path.split("/") if segment.strip()]
    normalized_path = "/" + "/".join(segment for segment in segments if segment)
    if normalized_path == "//" or not normalized_path:
        normalized_path = "/"
    return normalized_path


def normalize_navigation_path(path: str) -> str:
    parsed = urlsplit(path or "/")
    normalized_path = normalize_endpoint_label(parsed.path or "/")
    if parsed.query:
        normalized_path = f"{normalized_path}?query"
    if parsed.fragment:
        normalized_path = f"{normalized_path}#fragment"
    return normalized_path


def normalize_referrer_label(referrer: str | None) -> str:
    raw_referrer = _normalize_whitespace(referrer or "")
    if not raw_referrer:
        return "(direct)"

    parsed = urlsplit(raw_referrer)
    if not parsed.scheme or not parsed.netloc:
        return normalize_navigation_path(raw_referrer)

    origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
    normalized_path = normalize_endpoint_label(parsed.path or "/")
    return f"{origin}{normalized_path}"


def normalize_reason_label(reason: str | None) -> str:
    normalized = _normalize_whitespace(reason or UNKNOWN_LABEL).lower()
    normalized = re.sub(r"[^a-z0-9._:-]+", "_", normalized).strip("_")
    return normalized or UNKNOWN_LABEL


def classify_user_agent_family(user_agent: str | None) -> str:
    normalized = (user_agent or "").lower()
    if not normalized:
        return UNKNOWN_LABEL
    if "edg/" in normalized or "edge/" in normalized:
        return "edge"
    if "chrome/" in normalized and "edg/" not in normalized:
        return "chrome"
    if "firefox/" in normalized:
        return "firefox"
    if "safari/" in normalized and "chrome/" not in normalized:
        return "safari"
    if "iphone" in normalized or "ipad" in normalized:
        return "ios_webview"
    if "android" in normalized:
        return "android_webview"
    return "other"


def mask_ip_address(ip_address: str | None) -> str | None:
    raw_ip = _normalize_whitespace(ip_address or "")
    if not raw_ip:
        return None

    if ":" in raw_ip:
        parts = raw_ip.split(":")
        if len(parts) >= 4:
            return ":".join(parts[:4]) + ":xxxx:xxxx:xxxx:xxxx"
        return "ipv6_masked"

    octets = raw_ip.split(".")
    if len(octets) == 4:
        return ".".join(octets[:3] + ["x"])
    return "ip_masked"


class MetricsCollector:
    """
    Simple in-memory metrics collector.
    
    Tracks:
    - Request counts by endpoint
    - Response times
    - Error rates
    - AI provider usage
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._start_time = datetime.utcnow()
        
        # Request metrics
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.request_times: Dict[str, list] = defaultdict(list)
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.cardinality_overflow_counts: Dict[str, int] = defaultdict(int)
        self.cardinality_limits: Dict[str, int] = {
            "request_endpoint": MAX_REQUEST_ENDPOINT_SERIES,
            "navigation_path": MAX_NAVIGATION_PATH_SERIES,
            "navigation_referrer": MAX_REFERRER_SERIES,
            "admission_reason": MAX_ADMISSION_REASON_SERIES,
        }
        
        # AI Provider metrics
        self.ai_requests: Dict[str, int] = defaultdict(int)
        self.ai_tokens: Dict[str, int] = defaultdict(int)
        self.ai_errors: Dict[str, int] = defaultdict(int)
        
        # Training metrics
        self.training_jobs_started = 0
        self.training_jobs_completed = 0
        self.training_jobs_failed = 0
        
        # Generator metrics
        self.generations_by_tool: Dict[str, int] = defaultdict(int)
        self.generations_by_provider: Dict[str, int] = defaultdict(int)
        self.generation_outcomes_total: Dict[str, int] = defaultdict(int)
        self.generation_outcomes_by_provider: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.generation_latency_ms_by_provider: Dict[str, list] = defaultdict(list)

        # Frontend navigation telemetry
        self.invalid_navigation_count = 0
        self.invalid_navigation_by_path: Dict[str, int] = defaultdict(int)
        self.invalid_navigation_by_referrer: Dict[str, int] = defaultdict(int)

        # Admission control metrics
        self.admission_allowed: Dict[str, int] = defaultdict(int)
        self.admission_denied: Dict[str, int] = defaultdict(int)
        self.admission_denied_reasons: Dict[str, int] = defaultdict(int)

    def _cap_key(self, metric_name: str, bucket: Dict[str, int], key: str) -> str:
        normalized_key = key or UNKNOWN_LABEL
        limit = self.cardinality_limits.get(metric_name)
        if not limit:
            return normalized_key
        if normalized_key in bucket or len(bucket) < limit:
            return normalized_key
        self.cardinality_overflow_counts[metric_name] += 1
        return OVERFLOW_LABEL

    def _record_capped_count(self, metric_name: str, bucket: Dict[str, int], key: str):
        capped_key = self._cap_key(metric_name, bucket, key)
        bucket[capped_key] += 1
        return capped_key
    
    def record_request(self, endpoint: str, duration_ms: float, status_code: int):
        """Record an API request."""
        safe_endpoint = normalize_endpoint_label(endpoint)
        safe_endpoint = self._record_capped_count("request_endpoint", self.request_counts, safe_endpoint)
        
        # Keep only last 100 times for avg calculation
        times = self.request_times[safe_endpoint]
        times.append(duration_ms)
        if len(times) > 100:
            self.request_times[safe_endpoint] = times[-100:]
        
        if status_code >= 400:
            self.error_counts[safe_endpoint] += 1
    
    def record_ai_request(self, provider: str, tokens: int = 0, success: bool = True):
        """Record an AI provider request."""
        self.ai_requests[provider] += 1
        self.ai_tokens[provider] += tokens
        if not success:
            self.ai_errors[provider] += 1
    
    def record_generation(
        self,
        tool_name: str,
        provider: Optional[str] = None,
        outcome: str = "success",
        duration_ms: Optional[float] = None,
    ):
        """Record a generator tool usage and provider outcome telemetry."""
        self.generations_by_tool[tool_name] += 1
        safe_provider = (provider or "unknown").strip() or "unknown"
        safe_outcome = (outcome or "unknown").strip() or "unknown"
        self.generations_by_provider[safe_provider] += 1
        self.generation_outcomes_total[safe_outcome] += 1
        self.generation_outcomes_by_provider[safe_provider][safe_outcome] += 1

        if duration_ms is not None:
            samples = self.generation_latency_ms_by_provider[safe_provider]
            samples.append(float(duration_ms))
            if len(samples) > 100:
                self.generation_latency_ms_by_provider[safe_provider] = samples[-100:]
    
    def record_training_job(self, status: str):
        """Record training job status."""
        if status == "started":
            self.training_jobs_started += 1
        elif status == "completed":
            self.training_jobs_completed += 1
        elif status == "failed":
            self.training_jobs_failed += 1

    def record_invalid_navigation(self, path: str):
        """Record invalid frontend navigation."""
        safe_path = normalize_navigation_path(path or "/unknown")
        self.invalid_navigation_count += 1
        self._record_capped_count("navigation_path", self.invalid_navigation_by_path, safe_path)

    def record_invalid_navigation_referrer(self, referrer: str | None):
        safe_referrer = normalize_referrer_label(referrer)
        self._record_capped_count("navigation_referrer", self.invalid_navigation_by_referrer, safe_referrer)

    def record_admission(self, provider: str, decision: str, reason: str):
        safe_provider = provider or "unknown"
        safe_reason = normalize_reason_label(reason)
        if decision == "allow":
            self.admission_allowed[safe_provider] += 1
        else:
            self.admission_denied[safe_provider] += 1
            self._record_capped_count("admission_reason", self.admission_denied_reasons, safe_reason)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics as a dictionary."""
        uptime = datetime.utcnow() - self._start_time
        
        # Calculate average response times
        avg_times = {}
        for endpoint, times in self.request_times.items():
            if times:
                avg_times[endpoint] = sum(times) / len(times)

        avg_generation_latency = {}
        for provider, samples in self.generation_latency_ms_by_provider.items():
            if samples:
                avg_generation_latency[provider] = sum(samples) / len(samples)
        
        return {
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_human": str(uptime).split('.')[0],
            "start_time": self._start_time.isoformat(),
            
            "requests": {
                "total": sum(self.request_counts.values()),
                "by_endpoint": dict(self.request_counts),
                "errors": dict(self.error_counts),
                "avg_response_ms": avg_times
            },
            
            "ai_providers": {
                "requests": dict(self.ai_requests),
                "tokens": dict(self.ai_tokens),
                "errors": dict(self.ai_errors)
            },
            
            "generators": {
                "total": sum(self.generations_by_tool.values()),
                "by_tool": dict(self.generations_by_tool),
                "by_provider": dict(self.generations_by_provider),
                "outcomes_total": dict(self.generation_outcomes_total),
                "outcomes_by_provider": {
                    provider: dict(outcomes)
                    for provider, outcomes in self.generation_outcomes_by_provider.items()
                },
                "avg_latency_ms_by_provider": avg_generation_latency,
            },
            
            "training": {
                "started": self.training_jobs_started,
                "completed": self.training_jobs_completed,
                "failed": self.training_jobs_failed
            },

            "navigation": {
                "invalid_total": self.invalid_navigation_count,
                "invalid_by_path": dict(self.invalid_navigation_by_path),
                "invalid_by_referrer": dict(self.invalid_navigation_by_referrer),
            },

            "admission": {
                "allowed_by_provider": dict(self.admission_allowed),
                "denied_by_provider": dict(self.admission_denied),
                "denied_by_reason": dict(self.admission_denied_reasons),
            },
            "meta": {
                "cardinality": {
                    "request_endpoint": {
                        "limit": self.cardinality_limits["request_endpoint"],
                        "unique_keys": len(self.request_counts),
                        "overflowed_events": int(self.cardinality_overflow_counts.get("request_endpoint", 0)),
                    },
                    "navigation_path": {
                        "limit": self.cardinality_limits["navigation_path"],
                        "unique_keys": len(self.invalid_navigation_by_path),
                        "overflowed_events": int(self.cardinality_overflow_counts.get("navigation_path", 0)),
                    },
                    "navigation_referrer": {
                        "limit": self.cardinality_limits["navigation_referrer"],
                        "unique_keys": len(self.invalid_navigation_by_referrer),
                        "overflowed_events": int(self.cardinality_overflow_counts.get("navigation_referrer", 0)),
                    },
                    "admission_reason": {
                        "limit": self.cardinality_limits["admission_reason"],
                        "unique_keys": len(self.admission_denied_reasons),
                        "overflowed_events": int(self.cardinality_overflow_counts.get("admission_reason", 0)),
                    },
                }
            }
        }
    
    def get_prometheus_metrics(self) -> str:
        """Export metrics in Prometheus text format."""
        metrics = self.get_metrics()
        lines = []
        
        # Uptime
        lines.append(f"# HELP edumind_uptime_seconds Application uptime in seconds")
        lines.append(f"# TYPE edumind_uptime_seconds gauge")
        lines.append(f'edumind_uptime_seconds {metrics["uptime_seconds"]}')
        
        # Request counts
        lines.append(f"# HELP edumind_requests_total Total number of requests")
        lines.append(f"# TYPE edumind_requests_total counter")
        for endpoint, count in metrics["requests"]["by_endpoint"].items():
            safe_endpoint = endpoint.replace("/", "_").replace("-", "_")
            lines.append(f'edumind_requests_total{{endpoint="{safe_endpoint}"}} {count}')
        
        # AI requests
        lines.append(f"# HELP edumind_ai_requests_total Total AI provider requests")
        lines.append(f"# TYPE edumind_ai_requests_total counter")
        for provider, count in metrics["ai_providers"]["requests"].items():
            lines.append(f'edumind_ai_requests_total{{provider="{provider}"}} {count}')
        
        # Generator usage
        lines.append(f"# HELP edumind_generations_total Total generator tool usage")
        lines.append(f"# TYPE edumind_generations_total counter")
        for tool, count in metrics["generators"]["by_tool"].items():
            lines.append(f'edumind_generations_total{{tool="{tool}"}} {count}')
        lines.append("# HELP edumind_generations_by_provider_total Total generator requests by provider")
        lines.append("# TYPE edumind_generations_by_provider_total counter")
        for provider, count in metrics["generators"]["by_provider"].items():
            lines.append(f'edumind_generations_by_provider_total{{provider="{provider}"}} {count}')
        lines.append("# HELP edumind_generation_outcome_total Generator outcomes grouped by outcome")
        lines.append("# TYPE edumind_generation_outcome_total counter")
        for outcome, count in metrics["generators"]["outcomes_total"].items():
            lines.append(f'edumind_generation_outcome_total{{outcome="{outcome}"}} {count}')
        lines.append("# HELP edumind_generation_provider_outcome_total Generator outcomes grouped by provider and outcome")
        lines.append("# TYPE edumind_generation_provider_outcome_total counter")
        for provider, outcomes in metrics["generators"]["outcomes_by_provider"].items():
            for outcome, count in outcomes.items():
                lines.append(
                    f'edumind_generation_provider_outcome_total{{provider="{provider}",outcome="{outcome}"}} {count}'
                )
        lines.append("# HELP edumind_generation_provider_latency_ms_avg Average generation latency per provider")
        lines.append("# TYPE edumind_generation_provider_latency_ms_avg gauge")
        for provider, avg_latency in metrics["generators"]["avg_latency_ms_by_provider"].items():
            lines.append(f'edumind_generation_provider_latency_ms_avg{{provider="{provider}"}} {round(avg_latency, 3)}')

        # Invalid frontend navigation
        lines.append("# HELP edumind_navigation_invalid_total Total invalid frontend navigations")
        lines.append("# TYPE edumind_navigation_invalid_total counter")
        lines.append(f'edumind_navigation_invalid_total {metrics["navigation"]["invalid_total"]}')
        lines.append("# HELP edumind_navigation_invalid_by_path_total Invalid frontend navigations by path")
        lines.append("# TYPE edumind_navigation_invalid_by_path_total counter")
        for path, count in metrics["navigation"]["invalid_by_path"].items():
            safe_path = path.replace('"', '\\"')
            lines.append(f'edumind_navigation_invalid_by_path_total{{path="{safe_path}"}} {count}')
        lines.append("# HELP edumind_navigation_invalid_by_referrer_total Invalid frontend navigations by referrer")
        lines.append("# TYPE edumind_navigation_invalid_by_referrer_total counter")
        for referrer, count in metrics["navigation"]["invalid_by_referrer"].items():
            safe_referrer = referrer.replace('"', '\\"')
            lines.append(f'edumind_navigation_invalid_by_referrer_total{{referrer="{safe_referrer}"}} {count}')

        # Admission control
        lines.append("# HELP edumind_admission_allowed_total Allowed managed admission decisions by provider")
        lines.append("# TYPE edumind_admission_allowed_total counter")
        for provider, count in metrics["admission"]["allowed_by_provider"].items():
            lines.append(f'edumind_admission_allowed_total{{provider="{provider}"}} {count}')
        lines.append("# HELP edumind_admission_denied_total Denied managed admission decisions by provider")
        lines.append("# TYPE edumind_admission_denied_total counter")
        for provider, count in metrics["admission"]["denied_by_provider"].items():
            lines.append(f'edumind_admission_denied_total{{provider="{provider}"}} {count}')
        lines.append("# HELP edumind_admission_denied_reason_total Denied managed admission decisions by reason")
        lines.append("# TYPE edumind_admission_denied_reason_total counter")
        for reason, count in metrics["admission"]["denied_by_reason"].items():
            lines.append(f'edumind_admission_denied_reason_total{{reason="{reason}"}} {count}')

        return "\n".join(lines)


# Singleton instance
metrics = MetricsCollector()


def track_request(endpoint: str):
    """Decorator to track request metrics."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                status = getattr(result, 'status_code', 200)
                return result
            except Exception as e:
                status = 500
                raise
            finally:
                duration_ms = (time.time() - start) * 1000
                metrics.record_request(endpoint, duration_ms, status)
        return wrapper
    return decorator
