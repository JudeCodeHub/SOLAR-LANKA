"""Retain specification provenance and explicit retrieval/review timestamps."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012_product_sources"
down_revision = "0011_inverters"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_title", sa.Text(), nullable=True),
        sa.Column("specifications", postgresql.JSONB(), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(trim(source_url)) > 0", name="ck_product_sources_url"),
        sa.CheckConstraint(
            "jsonb_typeof(specifications) = 'object' AND specifications <> '{}'::jsonb",
            name="ck_product_sources_specifications",
        ),
        sa.CheckConstraint("verified_at >= retrieved_at", name="ck_product_sources_dates"),
    )
    op.create_index("ix_product_sources_product_id", "product_sources", ["product_id"])
    # Existing URLs lack retrieval dates and field-level evidence; do not invent a backfill.


def downgrade() -> None:
    op.drop_table("product_sources")
