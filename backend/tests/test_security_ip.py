"""Resolución de IP de cliente: solo cabeceras que fija el proxy."""

from types import SimpleNamespace

from app.core import security
from app.core.config import settings


def _request(peer: str, headers: dict) -> SimpleNamespace:
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


def test_cf_connecting_ip_se_ignora_por_defecto():
    req = _request("127.0.0.1", {"CF-Connecting-IP": "10.8.0.5", "X-Real-IP": "8.8.8.8"})
    assert security.get_client_ip(req) == "8.8.8.8"
    assert security.is_vpn_or_local_request(req) is False


def test_x_real_ip_solo_desde_proxy_fiable():
    req = _request("203.0.113.9", {"X-Real-IP": "10.8.0.5"})
    assert security.get_client_ip(req) == "203.0.113.9"


def test_cabecera_configurable(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_CLIENT_IP_HEADERS", ["CF-Connecting-IP", "X-Real-IP"])
    req = _request("127.0.0.1", {"CF-Connecting-IP": "198.51.100.4", "X-Real-IP": "8.8.8.8"})
    assert security.get_client_ip(req) == "198.51.100.4"
