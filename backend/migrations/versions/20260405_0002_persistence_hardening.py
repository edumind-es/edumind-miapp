#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""persistence hardening indexes and constraints

Revision ID: 20260405_0002
Revises: 20260214_0001
Create Date: 2026-04-05
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0002"
down_revision: Union[str, None] = "20260214_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_activitylog_user_created_at",
        "activitylog",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_apikey_user_engine_active",
        "apikey",
        ["user_id", "engine", "is_active"],
        unique=False,
    )
    op.create_index(
        "ix_classschedule_class_day_start",
        "classschedule",
        ["class_id", "day_of_week", "start_time"],
        unique=False,
    )
    op.create_index(
        "ix_generatedresource_user_type_created_at",
        "generatedresource",
        ["user_id", "resource_type", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_plannerentry_class_date_start",
        "plannerentry",
        ["class_id", "entry_date", "start_time"],
        unique=False,
    )
    op.create_index(
        "ix_plannerentry_resource_id",
        "plannerentry",
        ["resource_id"],
        unique=False,
    )
    op.create_index(
        "ix_plannerentry_user_date_start",
        "plannerentry",
        ["user_id", "entry_date", "start_time"],
        unique=False,
    )
    op.create_index(
        "ix_teacherclass_user_year_active",
        "teacherclass",
        ["user_id", "academic_year", "is_active"],
        unique=False,
    )

    with op.batch_alter_table("resourcelink") as batch_op:
        batch_op.create_unique_constraint(
            "uq_resourcelink_resource_class",
            ["resource_id", "class_id"],
        )

    with op.batch_alter_table("studentcode") as batch_op:
        batch_op.create_unique_constraint(
            "uq_studentcode_class_code",
            ["class_id", "code"],
        )
        batch_op.create_unique_constraint(
            "uq_studentcode_class_number",
            ["class_id", "number"],
        )


def downgrade() -> None:
    with op.batch_alter_table("studentcode") as batch_op:
        batch_op.drop_constraint("uq_studentcode_class_number", type_="unique")
        batch_op.drop_constraint("uq_studentcode_class_code", type_="unique")

    with op.batch_alter_table("resourcelink") as batch_op:
        batch_op.drop_constraint("uq_resourcelink_resource_class", type_="unique")

    op.drop_index("ix_teacherclass_user_year_active", table_name="teacherclass")
    op.drop_index("ix_plannerentry_user_date_start", table_name="plannerentry")
    op.drop_index("ix_plannerentry_resource_id", table_name="plannerentry")
    op.drop_index("ix_plannerentry_class_date_start", table_name="plannerentry")
    op.drop_index(
        "ix_generatedresource_user_type_created_at",
        table_name="generatedresource",
    )
    op.drop_index("ix_classschedule_class_day_start", table_name="classschedule")
    op.drop_index("ix_apikey_user_engine_active", table_name="apikey")
    op.drop_index("ix_activitylog_user_created_at", table_name="activitylog")
