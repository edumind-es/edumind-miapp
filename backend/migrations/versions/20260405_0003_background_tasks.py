#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""background tasks and document processing state

Revision ID: 20260405_0003
Revises: 20260405_0002
Create Date: 2026-04-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260405_0003"
down_revision: Union[str, None] = "20260405_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("document") as batch_op:
        batch_op.add_column(
            sa.Column("processing_status", sa.String(), nullable=False, server_default="uploaded")
        )
        batch_op.add_column(sa.Column("processing_started_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("processed_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("parse_error", sa.String(), nullable=True))
        batch_op.create_index("ix_document_processing_status", ["processing_status"], unique=False)

    op.execute(
        sa.text(
            "UPDATE document SET processing_status = CASE WHEN processed THEN 'completed' ELSE 'uploaded' END"
        )
    )

    op.create_table(
        "backgroundtaskjob",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=9), nullable=False),
        sa.Column("dedupe_key", sa.String(), nullable=True),
        sa.Column("payload", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("available_at", sa.DateTime(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.String(), nullable=True),
        sa.Column("result", sa.String(), nullable=True),
        sa.Column("worker_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_backgroundtaskjob_available_at", "backgroundtaskjob", ["available_at"], unique=False)
    op.create_index("ix_backgroundtaskjob_created_at", "backgroundtaskjob", ["created_at"], unique=False)
    op.create_index("ix_backgroundtaskjob_dedupe_key", "backgroundtaskjob", ["dedupe_key"], unique=False)
    op.create_index("ix_backgroundtaskjob_status", "backgroundtaskjob", ["status"], unique=False)
    op.create_index("ix_backgroundtaskjob_task_type", "backgroundtaskjob", ["task_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_backgroundtaskjob_task_type", table_name="backgroundtaskjob")
    op.drop_index("ix_backgroundtaskjob_status", table_name="backgroundtaskjob")
    op.drop_index("ix_backgroundtaskjob_dedupe_key", table_name="backgroundtaskjob")
    op.drop_index("ix_backgroundtaskjob_created_at", table_name="backgroundtaskjob")
    op.drop_index("ix_backgroundtaskjob_available_at", table_name="backgroundtaskjob")
    op.drop_table("backgroundtaskjob")

    with op.batch_alter_table("document") as batch_op:
        batch_op.drop_index("ix_document_processing_status")
        batch_op.drop_column("parse_error")
        batch_op.drop_column("processed_at")
        batch_op.drop_column("processing_started_at")
        batch_op.drop_column("processing_status")
