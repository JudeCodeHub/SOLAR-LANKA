"""Company-specific prices and declared claims, outside canonical products."""

import sqlalchemy as sa
from alembic import op

revision = "0014_product_offers"
down_revision = "0013_product_archive"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_offers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("indicative_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("is_demo_price", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("company_claim", sa.Text(), nullable=True),
        sa.Column("claim_label", sa.String(32), nullable=False, server_default="company_declared"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("company_id", "product_id", name="uq_product_offers_company_product"),
        sa.CheckConstraint("indicative_price >= 0", name="ck_product_offers_price"),
        sa.CheckConstraint(
            "(indicative_price IS NULL AND currency IS NULL) OR "
            "(indicative_price IS NOT NULL AND currency ~ '^[A-Z]{3}$')",
            name="ck_product_offers_price_currency",
        ),
        sa.CheckConstraint(
            "claim_label = 'company_declared'", name="ck_product_offers_claim_label"
        ),
    )
    op.create_index("ix_product_offers_company_id", "product_offers", ["company_id"])
    op.create_index("ix_product_offers_product_id", "product_offers", ["product_id"])


def downgrade() -> None:
    op.drop_table("product_offers")
