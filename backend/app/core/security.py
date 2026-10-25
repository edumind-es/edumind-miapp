#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

from ipaddress import ip_address

from fastapi import Request

from typing import Optional

from app.core.config import settings


def _normalize_ip(raw_ip: str) -> str:
    if not raw_ip:
        return ""
    ip = raw_ip.strip()
    if ip.startswith("[") and ip.endswith("]"):
        ip = ip[1:-1]
    return ip


def _trusted_forwarded_ip(request: Request) -> str:
    # Solo se aceptan las cabeceras que el proxy fija de forma explícita.
    # Por defecto únicamente X-Real-IP: nginx la sobrescribe siempre con
    # $remote_addr, mientras que CF-Connecting-IP solo es fiable si la pone
    # Cloudflare y el origen está protegido (se habilita por configuración).
    for header_name in settings.TRUSTED_CLIENT_IP_HEADERS:
        header_value = _normalize_ip(request.headers.get(header_name, ""))
        if header_value:
            return header_value

    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        first_hop = _normalize_ip(forwarded_for.split(",")[0])
        if first_hop:
            return first_hop
    return ""


def get_client_ip(request: Request) -> str:
    """
    Return the best client IP using X-Forwarded-For only when the immediate
    peer is a trusted proxy.
    """
    peer_ip = _normalize_ip(request.client.host if request.client else "")
    if peer_ip in settings.TRUSTED_PROXIES:
        forwarded_ip = _trusted_forwarded_ip(request)
        if forwarded_ip:
            return forwarded_ip
    return peer_ip


def is_private_or_loopback_ip(raw_ip: str) -> bool:
    try:
        parsed = ip_address(_normalize_ip(raw_ip))
        return bool(parsed.is_private or parsed.is_loopback)
    except ValueError:
        return False


def is_vpn_or_local_request(request: Request) -> bool:
    return is_private_or_loopback_ip(get_client_ip(request))


def get_client_ip_for_log(request) -> Optional[str]:
    """IP del cliente ya enmascarada (último octeto o mitad IPv6) para registros persistentes.

    La IP completa solo se usa en memoria (límite de peticiones, allowlist de VPN);
    lo que se escribe en base de datos nunca identifica a la persona por sí solo.
    """
    from app.services.metrics_service import mask_ip_address  # import local: evita un ciclo

    return mask_ip_address(get_client_ip(request))
