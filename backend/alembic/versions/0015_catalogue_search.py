"""Indexes for visible catalogue ordering, case-insensitive search, and spec filters."""

from alembic import op

revision = "0015_catalogue_search"
down_revision = "0014_product_offers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index(
        "ix_products_visible_order", "products", ["kind", "is_archived", "brand", "model", "id"]
    )
    op.execute(
        "CREATE INDEX ix_products_brand_trgm ON products USING gin (lower(brand) gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_products_model_trgm ON products USING gin (lower(model) gin_trgm_ops)"
    )
    op.create_index("ix_panels_wattage_w", "panels", ["wattage_w"])
    op.create_index("ix_panels_efficiency_percent", "panels", ["efficiency_percent"])
    op.create_index("ix_inverters_category_capacity", "inverters", ["category", "capacity_kw"])


def downgrade() -> None:
    op.drop_index("ix_inverters_category_capacity", table_name="inverters")
    op.drop_index("ix_panels_efficiency_percent", table_name="panels")
    op.drop_index("ix_panels_wattage_w", table_name="panels")
    op.drop_index("ix_products_model_trgm", table_name="products")
    op.drop_index("ix_products_brand_trgm", table_name="products")
    op.drop_index("ix_products_visible_order", table_name="products")
    # Keep pg_trgm: other database objects may use it.
