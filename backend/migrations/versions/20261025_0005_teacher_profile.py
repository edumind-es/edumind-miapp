#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""perfil pedagógico del docente (teacherprofile)

Revision ID: 20261025_0005
Revises: 20260405_0004
Create Date: 2026-10-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20261025_0005"
down_revision: Union[str, None] = "20260405_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Una fila por docente; solo preferencias pedagógicas (sin datos personales).
    op.create_table(
        "teacherprofile",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comunidad_key", sa.String(), nullable=True),
        sa.Column("etapa_key", sa.String(), nullable=True),
        sa.Column("area_key", sa.String(), nullable=True),
        sa.Column("curso", sa.String(), nullable=True),
        sa.Column("matriz_id", sa.String(), nullable=True),
        sa.Column("metodologia_slider", sa.Integer(), nullable=True),
        sa.Column("tipo_agrupamiento", sa.String(), nullable=True),
        sa.Column("contexto_aula", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teacherprofile_user_id", "teacherprofile", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_teacherprofile_user_id", table_name="teacherprofile")
    op.drop_table("teacherprofile")
