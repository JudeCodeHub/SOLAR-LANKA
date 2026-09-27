"""Add soft archival for canonical products."""

import sqlalchemy as sa
from alembic import op

revision = "0013_product_archive"
down_revision = "0012_product_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("products", "is_archived")
