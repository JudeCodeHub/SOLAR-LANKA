"""Allow private company credential documents with explicit company ownership."""

from alembic import op

revision = "0019_company_credentials"
down_revision = "0018_media_public_urls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_media_assets_category_visibility", "media_assets", type_="check")
    op.drop_constraint("ck_media_assets_category_parent", "media_assets", type_="check")
    op.create_check_constraint(
        "ck_media_assets_category_visibility",
        "media_assets",
        "(category IN ('product_image', 'company_logo', 'installation_gallery', "
        "'product_datasheet') AND visibility = 'public') OR "
        "(category IN ('company_credential_document', 'quotation_document', "
        "'installation_evidence', 'support_evidence') AND visibility = 'private')",
    )
    op.create_check_constraint(
        "ck_media_assets_category_parent",
        "media_assets",
        "(category IN ('product_image', 'product_datasheet') AND parent_kind = 'product') OR "
        "(category IN ('company_logo', 'company_credential_document') "
        "AND parent_kind = 'company') OR "
        "(category IN ('installation_gallery', 'installation_evidence') "
        "AND parent_kind = 'installation') OR "
        "(category = 'quotation_document' AND parent_kind = 'quotation_revision') OR "
        "(category = 'support_evidence' AND parent_kind = 'support_case')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_media_assets_category_visibility", "media_assets", type_="check")
    op.drop_constraint("ck_media_assets_category_parent", "media_assets", type_="check")
    op.create_check_constraint(
        "ck_media_assets_category_visibility",
        "media_assets",
        "(category IN ('product_image', 'company_logo', 'installation_gallery', "
        "'product_datasheet') AND visibility = 'public') OR "
        "(category IN ('quotation_document', 'installation_evidence', "
        "'support_evidence') AND visibility = 'private')",
    )
    op.create_check_constraint(
        "ck_media_assets_category_parent",
        "media_assets",
        "(category IN ('product_image', 'product_datasheet') AND parent_kind = 'product') OR "
        "(category = 'company_logo' AND parent_kind = 'company') OR "
        "(category IN ('installation_gallery', 'installation_evidence') "
        "AND parent_kind = 'installation') OR "
        "(category = 'quotation_document' AND parent_kind = 'quotation_revision') OR "
        "(category = 'support_evidence' AND parent_kind = 'support_case')",
    )
