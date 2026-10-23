#!/usr/bin/env python3
#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy import MetaData, create_engine, select, text
from sqlalchemy.engine import make_url
from sqlmodel import SQLModel

from app import models  # noqa: F401  # ensure metadata is populated


BACKEND_DIR = Path(__file__).resolve().parents[1]


def build_engine(database_url: str):
    parsed = make_url(database_url)
    kwargs = {"echo": False}
    if parsed.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
    return create_engine(database_url, **kwargs)


def reset_postgres_sequences(connection) -> None:
    for table in SQLModel.metadata.sorted_tables:
        if "id" not in table.c:
            continue
        connection.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('"{table.name}"', 'id'),
                    COALESCE((SELECT MAX(id) FROM "{table.name}"), 1),
                    (SELECT MAX(id) IS NOT NULL FROM "{table.name}")
                )
                """
            )
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy EDUmind data from SQLite to PostgreSQL.")
    parser.add_argument("--source", required=True, help="Source database URL")
    parser.add_argument("--target", required=True, help="Target database URL")
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="Delete target table contents before importing",
    )
    args = parser.parse_args()

    source_engine = build_engine(args.source)
    target_engine = build_engine(args.target)
    source_metadata = MetaData()
    source_metadata.reflect(bind=source_engine)

    with source_engine.connect() as source_conn, target_engine.begin() as target_conn:
        if args.truncate_target:
            for table in reversed(SQLModel.metadata.sorted_tables):
                target_conn.execute(table.delete())

        for table in SQLModel.metadata.sorted_tables:
            source_table = source_metadata.tables.get(table.name)
            if source_table is None:
                continue

            common_columns = [
                column.name
                for column in table.columns
                if column.name in source_table.columns
            ]
            if not common_columns:
                continue

            source_rows = source_conn.execute(
                select(*(source_table.c[column_name] for column_name in common_columns))
            ).all()
            rows = [dict(row._mapping) for row in source_rows]
            if rows:
                target_conn.execute(table.insert(), rows)

        reset_postgres_sequences(target_conn)

    print("SQLite -> PostgreSQL migration completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
