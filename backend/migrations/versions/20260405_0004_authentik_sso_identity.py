#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""authentik sso identity fields

Revision ID: 20260405_0004
Revises: 20260405_0003
Create Date: 2026-04-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260405_0004"
down_revision: Union[str, None] = "20260405_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user") as batch_op:
        batch_op.add_column(
            sa.Column("auth_provider", sa.String(), nullable=False, server_default="local")
        )
        batch_op.add_column(sa.Column("oidc_subject", sa.String(), nullable=True))
        batch_op.create_index("ix_user_auth_provider", ["auth_provider"], unique=False)
        batch_op.create_index("ix_user_oidc_subject", ["oidc_subject"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("user") as batch_op:
        batch_op.drop_index("ix_user_oidc_subject")
        batch_op.drop_index("ix_user_auth_provider")
        batch_op.drop_column("oidc_subject")
        batch_op.drop_column("auth_provider")
