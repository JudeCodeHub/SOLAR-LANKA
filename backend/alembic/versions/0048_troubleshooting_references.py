"""Sourced troubleshooting references tied to one exact product."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0048_troubleshooting_references"
down_revision = "0047_site_visit_work"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "troubleshooting_references",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(64)),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("steps", postgresql.JSONB(), nullable=False),
        sa.Column("safety_level", sa.String(24), nullable=False),
        sa.Column("hazard_warning", sa.Text()),
        sa.Column("source_title", sa.String(300), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_page", sa.String(64)),
        sa.Column("verified_on", sa.DateTime(timezone=True)),
        sa.Column("is_sample", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["app_users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')", name="ck_troubleshooting_status"
        ),
        sa.CheckConstraint(
            "safety_level IN ('safe_observation', 'hazard')", name="ck_troubleshooting_safety"
        ),
        sa.CheckConstraint(
            "jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 10",
            name="ck_troubleshooting_steps",
        ),
        sa.CheckConstraint(
            "safety_level <> 'hazard' OR length(trim(coalesce(hazard_warning, ''))) > 0",
            name="ck_troubleshooting_hazard_warning",
        ),
        sa.CheckConstraint(
            "status <> 'published' OR (length(trim(source_url)) > 0 AND verified_on IS NOT NULL "
            "AND length(trim(source_title)) > 0)",
            name="ck_troubleshooting_published_sourced",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_troubleshooting_product_status",
        "troubleshooting_references",
        ["product_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_troubleshooting_product_status", table_name="troubleshooting_references")
    op.drop_table("troubleshooting_references")
