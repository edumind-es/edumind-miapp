#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

"""Memoria acotada del chat: el navegador envía todo el historial; aquí se recorta.

Se conservan los últimos turnos dentro de un presupuesto de caracteres, siempre con
el último mensaje del usuario. Menos contexto irrelevante, menos coste y menos
riesgo de desbordar la ventana del modelo.
"""

from typing import Any, Dict, List


def trim_chat_history(messages: List[Dict[str, Any]], max_messages: int, max_chars: int) -> List[Dict[str, Any]]:
    if not messages:
        return []
    system = [m for m in messages if m.get("role") == "system"]
    dialogo = [m for m in messages if m.get("role") != "system"]
    if not dialogo:
        return system

    seleccion: List[Dict[str, Any]] = []
    presupuesto = max(max_chars - sum(len(str(m.get("content") or "")) for m in system), 0)
    for mensaje in reversed(dialogo):
        coste = len(str(mensaje.get("content") or ""))
        if seleccion and (len(seleccion) >= max_messages or coste > presupuesto):
            break
        seleccion.append(mensaje)
        presupuesto -= coste
    seleccion.reverse()
    # Que la conversación no empiece por una respuesta del asistente huérfana
    while len(seleccion) > 1 and seleccion[0].get("role") == "assistant":
        seleccion.pop(0)
    return system + seleccion
