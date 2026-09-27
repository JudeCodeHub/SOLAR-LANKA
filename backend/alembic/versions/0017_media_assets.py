"""Persist provider IDs, owners, parent references, and visibility."""

import sqlalchemy as sa
from alembic import op

revision = "0017_media_assets"
down_revision = "0016_favourites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_file_id", sa.String(255), nullable=False),
        sa.Column(
            "owner_user_id",
            sa.Uuid(),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("category", sa.String(32), nullable=False),
        sa.Column("parent_kind", sa.String(32), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=False),
        sa.Column("visibility", sa.String(16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("provider", "provider_file_id", name="uq_media_assets_provider_file"),
        sa.CheckConstraint("length(trim(provider)) > 0", name="ck_media_assets_provider"),
        sa.CheckConstraint(
            "length(trim(provider_file_id)) > 0", name="ck_media_assets_provider_file_id"
        ),
        sa.CheckConstraint(
            "(category IN ('product_image', 'company_logo', 'installation_gallery', "
            "'product_datasheet') AND visibility = 'public') OR "
            "(category IN ('quotation_document', 'installation_evidence', "
            "'support_evidence') AND visibility = 'private')",
            name="ck_media_assets_category_visibility",
        ),
        sa.CheckConstraint(
            "(category IN ('product_image', 'product_datasheet') AND parent_kind = 'product') OR "
            "(category = 'company_logo' AND parent_kind = 'company') OR "
            "(category IN ('installation_gallery', 'installation_evidence') "
            "AND parent_kind = 'installation') OR "
            "(category = 'quotation_document' AND parent_kind = 'quotation_revision') OR "
            "(category = 'support_evidence' AND parent_kind = 'support_case')",
            name="ck_media_assets_category_parent",
        ),
    )
    op.create_index("ix_media_assets_owner_user_id", "media_assets", ["owner_user_id"])
    op.create_index("ix_media_assets_parent", "media_assets", ["parent_kind", "parent_id"])


def downgrade() -> None:
    op.drop_table("media_assets")
