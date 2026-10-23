#
# Copyright (C) 2024-2025 EDUmind - Los Mundos Edufis
#

"""initial schema baseline

Revision ID: 20260214_0001
Revises:
Create Date: 2026-02-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260214_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("role", sa.String(length=15), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_email", "user", ["email"], unique=False)
    op.create_index("ix_user_username", "user", ["username"], unique=True)

    op.create_table(
        "document",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.Column("processed", sa.Boolean(), nullable=False),
        sa.Column("uploader_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["uploader_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "apikey",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("engine", sa.String(), nullable=False),
        sa.Column("encrypted_key", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("last_used", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_apikey_engine", "apikey", ["engine"], unique=False)

    op.create_table(
        "trainingitem",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instruction", sa.String(), nullable=False),
        sa.Column("output", sa.String(), nullable=False),
        sa.Column("source", sa.String(length=6), nullable=False),
        sa.Column("quality_score", sa.Integer(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("verified_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("creator_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"]),
        sa.ForeignKeyConstraint(["verified_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "trainingjob",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=9), nullable=False),
        sa.Column("dataset_path", sa.String(), nullable=True),
        sa.Column("model_path", sa.String(), nullable=True),
        sa.Column("example_count", sa.Integer(), nullable=False),
        sa.Column("epochs", sa.Integer(), nullable=False),
        sa.Column("learning_rate", sa.Float(), nullable=False),
        sa.Column("base_model", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "activitylog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "systemconfig",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_systemconfig_key", "systemconfig", ["key"], unique=True)

    op.create_table(
        "appfeedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("context", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "teacherclass",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("course", sa.String(), nullable=False),
        sa.Column("group", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("academic_year", sa.String(), nullable=False),
        sa.Column("student_count", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teacherclass_user_id", "teacherclass", ["user_id"], unique=False)

    op.create_table(
        "generatedresource",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("resource_type", sa.String(length=9), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("generation_params", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_generatedresource_user_id", "generatedresource", ["user_id"], unique=False)

    op.create_table(
        "classschedule",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(), nullable=False),
        sa.Column("end_time", sa.String(), nullable=False),
        sa.Column("room", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["class_id"], ["teacherclass.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_classschedule_class_id", "classschedule", ["class_id"], unique=False)

    op.create_table(
        "studentcode",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["teacherclass.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_studentcode_class_id", "studentcode", ["class_id"], unique=False)

    op.create_table(
        "resourcelink",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("assigned_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["teacherclass.id"]),
        sa.ForeignKeyConstraint(["resource_id"], ["generatedresource.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resourcelink_class_id", "resourcelink", ["class_id"], unique=False)
    op.create_index("ix_resourcelink_resource_id", "resourcelink", ["resource_id"], unique=False)

    op.create_table(
        "plannerentry",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(), nullable=False),
        sa.Column("end_time", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=11), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["teacherclass.id"]),
        sa.ForeignKeyConstraint(["resource_id"], ["generatedresource.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plannerentry_class_id", "plannerentry", ["class_id"], unique=False)
    op.create_index("ix_plannerentry_user_id", "plannerentry", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_plannerentry_user_id", table_name="plannerentry")
    op.drop_index("ix_plannerentry_class_id", table_name="plannerentry")
    op.drop_table("plannerentry")

    op.drop_index("ix_resourcelink_resource_id", table_name="resourcelink")
    op.drop_index("ix_resourcelink_class_id", table_name="resourcelink")
    op.drop_table("resourcelink")

    op.drop_index("ix_studentcode_class_id", table_name="studentcode")
    op.drop_table("studentcode")

    op.drop_index("ix_classschedule_class_id", table_name="classschedule")
    op.drop_table("classschedule")

    op.drop_index("ix_generatedresource_user_id", table_name="generatedresource")
    op.drop_table("generatedresource")

    op.drop_index("ix_teacherclass_user_id", table_name="teacherclass")
    op.drop_table("teacherclass")

    op.drop_table("appfeedback")

    op.drop_index("ix_systemconfig_key", table_name="systemconfig")
    op.drop_table("systemconfig")

    op.drop_table("activitylog")
    op.drop_table("trainingjob")
    op.drop_table("trainingitem")

    op.drop_index("ix_apikey_engine", table_name="apikey")
    op.drop_table("apikey")

    op.drop_table("document")

    op.drop_index("ix_user_username", table_name="user")
    op.drop_index("ix_user_email", table_name="user")
    op.drop_table("user")
