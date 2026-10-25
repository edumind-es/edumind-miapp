#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Minimización de datos antes de guardar texto en el dataset de entrenamiento.

No sustituye al consentimiento ni a la revisión humana: elimina lo que una
expresión regular puede reconocer con seguridad (correos, teléfonos, DNI/NIE,
IBAN). Los nombres propios no se detectan aquí; por eso la UI exige confirmar
que el texto no identifica a nadie y los ítems pasan por verificación manual.
"""

import re
from typing import Tuple

_PATRONES = [
    ("[correo]", re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", re.IGNORECASE)),
    ("[iban]", re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b")),
    ("[nie]", re.compile(r"\b[XYZxyz][-\s]?\d{7}[-\s]?[A-Za-z]\b")),
    ("[dni]", re.compile(r"\b\d{8}[-\s]?[A-Za-z]\b")),
    ("[teléfono]", re.compile(r"(?<!\d)(?:\+34[\s-]?)?[6789](?:[\s-]?\d){8}(?!\d)")),
]


def scrub_personal_data(text: str) -> Tuple[str, int]:
    """Devuelve el texto con los datos personales reconocibles sustituidos y cuántos se sustituyeron."""
    if not text:
        return text, 0
    total = 0
    limpio = text
    for etiqueta, patron in _PATRONES:
        limpio, n = patron.subn(etiqueta, limpio)
        total += n
    return limpio, total


def scrub_payload(value):
    """Aplica scrub_personal_data a todas las cadenas de un payload (dict/list anidados)."""
    if isinstance(value, str):
        return scrub_personal_data(value)[0]
    if isinstance(value, list):
        return [scrub_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: scrub_payload(item) for key, item in value.items()}
    return value
