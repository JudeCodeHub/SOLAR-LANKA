"""Canonical products and nullable panel specifications with explicit units."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_panels"
down_revision = "0009_audit_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("brand", sa.String(255), nullable=False),
        sa.Column("model", sa.String(255), nullable=False),
        sa.Column("image_urls", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("datasheet_urls", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("kind IN ('panel', 'inverter')", name="ck_products_kind"),
        sa.CheckConstraint("length(trim(brand)) > 0", name="ck_products_brand"),
        sa.CheckConstraint("length(trim(model)) > 0", name="ck_products_model"),
    )
    op.create_table(
        "panels",
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column("wattage_w", sa.Numeric(10, 3), nullable=True),
        sa.Column("efficiency_percent", sa.Numeric(6, 3), nullable=True),
        sa.Column("cell_type", sa.String(100), nullable=True),
        sa.Column("voltage_at_max_power_v", sa.Numeric(10, 3), nullable=True),
        sa.Column("open_circuit_voltage_v", sa.Numeric(10, 3), nullable=True),
        sa.Column("current_at_max_power_a", sa.Numeric(10, 3), nullable=True),
        sa.Column("short_circuit_current_a", sa.Numeric(10, 3), nullable=True),
        sa.Column("product_warranty_years", sa.Numeric(6, 2), nullable=True),
        sa.Column("performance_warranty_years", sa.Numeric(6, 2), nullable=True),
        sa.Column("warranty_details", sa.Text(), nullable=True),
        sa.Column("country_of_manufacture", sa.String(100), nullable=True),
        sa.CheckConstraint("wattage_w > 0", name="ck_panels_wattage"),
        sa.CheckConstraint(
            "efficiency_percent > 0 AND efficiency_percent <= 100", name="ck_panels_efficiency"
        ),
        sa.CheckConstraint("voltage_at_max_power_v > 0", name="ck_panels_vmp"),
        sa.CheckConstraint("open_circuit_voltage_v > 0", name="ck_panels_voc"),
        sa.CheckConstraint("current_at_max_power_a > 0", name="ck_panels_imp"),
        sa.CheckConstraint("short_circuit_current_a > 0", name="ck_panels_isc"),
        sa.CheckConstraint("product_warranty_years >= 0", name="ck_panels_product_warranty"),
        sa.CheckConstraint(
            "performance_warranty_years >= 0", name="ck_panels_performance_warranty"
        ),
    )


def downgrade() -> None:
    op.drop_table("panels")
    op.drop_table("products")
