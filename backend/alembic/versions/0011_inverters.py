"""Nullable inverter specifications and sourced compatibility."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011_inverters"
down_revision = "0010_panels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inverters",
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("category", sa.String(16), nullable=True),
        sa.Column("capacity_kw", sa.Numeric(10, 3), nullable=True),
        sa.Column("mppt_count", sa.Integer(), nullable=True),
        sa.Column("connectivity", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("warranty_years", sa.Numeric(6, 2), nullable=True),
        sa.Column("warranty_details", sa.Text(), nullable=True),
        sa.Column("compatibility_notes", sa.Text(), nullable=True),
        sa.Column("compatibility_source_url", sa.Text(), nullable=True),
        sa.Column("manual_urls", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("manufacturer_document_urls", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("error_code_reference_urls", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.CheckConstraint(
            "category IN ('on_grid', 'off_grid', 'hybrid')", name="ck_inverters_category"
        ),
        sa.CheckConstraint("capacity_kw > 0", name="ck_inverters_capacity"),
        sa.CheckConstraint("mppt_count >= 0", name="ck_inverters_mppt_count"),
        sa.CheckConstraint("warranty_years >= 0", name="ck_inverters_warranty"),
        sa.CheckConstraint(
            "compatibility_notes IS NULL OR "
            "(compatibility_source_url IS NOT NULL AND length(trim(compatibility_source_url)) > 0)",
            name="ck_inverters_compatibility_source",
        ),
    )


def downgrade() -> None:
    op.drop_table("inverters")
