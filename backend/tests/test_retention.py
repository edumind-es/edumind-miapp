#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
# Author: Luis Vilela Acuña
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#

from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlmodel import Session, select

from app.core.security import get_client_ip_for_log
from app.db import engine
from app.models import ActivityLog
from app.services.retention_service import purge_activity_log


def _peticion(ip: str):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=ip))


def test_ip_para_registro_va_enmascarada():
    assert get_client_ip_for_log(_peticion("203.0.113.42")) == "203.0.113.x"
    assert get_client_ip_for_log(_peticion("2001:db8:1:2:3:4:5:6")) == "2001:db8:1:2:xxxx:xxxx:xxxx:xxxx"


def test_purga_borra_solo_registros_antiguos(client):
    marca = f"retencion-{datetime.utcnow().timestamp()}"
    with Session(engine) as session:
        session.add(ActivityLog(action=marca, created_at=datetime.utcnow() - timedelta(days=120)))
        session.add(ActivityLog(action=marca, created_at=datetime.utcnow() - timedelta(days=10)))
        session.commit()

        borrados = purge_activity_log(session, retention_days=90)
        assert borrados >= 1

        restantes = session.exec(select(ActivityLog).where(ActivityLog.action == marca)).all()
        assert len(restantes) == 1
        assert restantes[0].created_at > datetime.utcnow() - timedelta(days=90)

        session.delete(restantes[0])
        session.commit()


def test_purga_desactivada_con_cero_dias(client):
    with Session(engine) as session:
        assert purge_activity_log(session, retention_days=0) == 0
