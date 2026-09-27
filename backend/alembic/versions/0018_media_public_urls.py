"""Retain only provider-verified public delivery URLs."""

import sqlalchemy as sa
from alembic import op

revision = "0018_media_public_urls"
down_revision = "0017_media_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_assets", sa.Column("public_url", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_media_assets_public_url",
        "media_assets",
        "visibility = 'public' OR public_url IS NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_media_assets_public_url", "media_assets", type_="check")
    op.drop_column("media_assets", "public_url")
