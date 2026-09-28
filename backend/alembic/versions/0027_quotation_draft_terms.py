"""Store draft line types, equipment references, taxes, and discounts."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0027_quotation_draft_terms"
down_revision = "0026_quotation_revisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quotation_revisions",
        sa.Column("discount_kind", sa.String(8), nullable=False, server_default="none"),
    )
    op.add_column(
        "quotation_revisions",
        sa.Column("discount_value", sa.Numeric(18, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "quotation_revisions",
        sa.Column("tax_rate_percent", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
    )
    op.create_check_constraint(
        "ck_quotation_discount_kind",
        "quotation_revisions",
        "discount_kind IN ('none', 'fixed', 'percent')",
    )
    op.create_check_constraint(
        "ck_quotation_discount_value", "quotation_revisions", "discount_value >= 0"
    )
    op.create_check_constraint(
        "ck_quotation_tax_rate", "quotation_revisions", "tax_rate_percent BETWEEN 0 AND 100"
    )
    op.add_column(
        "quotation_line_items",
        sa.Column("kind", sa.String(16), nullable=False, server_default="charge"),
    )
    op.add_column("quotation_line_items", sa.Column("product_id", UUID(as_uuid=True)))
    op.create_foreign_key(
        "fk_quotation_line_items_product",
        "quotation_line_items",
        "products",
        ["product_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_quotation_line_kind_product",
        "quotation_line_items",
        "(kind = 'equipment' AND product_id IS NOT NULL) OR "
        "(kind = 'charge' AND product_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_quotation_line_kind_product", "quotation_line_items", type_="check")
    op.drop_constraint(
        "fk_quotation_line_items_product", "quotation_line_items", type_="foreignkey"
    )
    op.drop_column("quotation_line_items", "product_id")
    op.drop_column("quotation_line_items", "kind")
    op.drop_constraint("ck_quotation_tax_rate", "quotation_revisions", type_="check")
    op.drop_constraint("ck_quotation_discount_value", "quotation_revisions", type_="check")
    op.drop_constraint("ck_quotation_discount_kind", "quotation_revisions", type_="check")
    op.drop_column("quotation_revisions", "tax_rate_percent")
    op.drop_column("quotation_revisions", "discount_value")
    op.drop_column("quotation_revisions", "discount_kind")
