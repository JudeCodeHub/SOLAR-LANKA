"""Save products per customer with a unique owner/product key."""

import sqlalchemy as sa
from alembic import op

revision = "0016_favourites"
down_revision = "0015_catalogue_search"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "favourites",
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_favourites_product_id", "favourites", ["product_id"])


def downgrade() -> None:
    op.drop_table("favourites")
