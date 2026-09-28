"""Metadata for uploaded public media and private documents."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base

PUBLIC_CATEGORIES = "'product_image', 'company_logo', 'installation_gallery', 'product_datasheet'"
PRIVATE_CATEGORIES = (
    "'company_credential_document', 'quotation_document', "
    "'installation_evidence', 'support_evidence'"
)


class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        UniqueConstraint("provider", "provider_file_id", name="uq_media_assets_provider_file"),
        Index("ix_media_assets_parent", "parent_kind", "parent_id"),
        CheckConstraint("length(trim(provider)) > 0", name="ck_media_assets_provider"),
        CheckConstraint(
            "visibility = 'public' OR public_url IS NULL", name="ck_media_assets_public_url"
        ),
        CheckConstraint(
            "length(trim(provider_file_id)) > 0", name="ck_media_assets_provider_file_id"
        ),
        CheckConstraint(
            f"(category IN ({PUBLIC_CATEGORIES}) AND visibility = 'public') OR "
            f"(category IN ({PRIVATE_CATEGORIES}) AND visibility = 'private')",
            name="ck_media_assets_category_visibility",
        ),
        CheckConstraint(
            "(category IN ('product_image', 'product_datasheet') AND parent_kind = 'product') OR "
            "(category IN ('company_logo', 'company_credential_document') "
            "AND parent_kind = 'company') OR "
            "(category IN ('installation_gallery', 'installation_evidence') "
            "AND parent_kind = 'installation') OR "
            "(category = 'quotation_document' AND parent_kind = 'quotation_revision') OR "
            "(category = 'support_evidence' AND parent_kind = 'support_case')",
            name="ck_media_assets_category_parent",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_file_id: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    parent_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    # Some parent tables arrive in later phases; verify this reference in the upload service.
    parent_id: Mapped[UUID] = mapped_column(nullable=False)
    visibility: Mapped[str] = mapped_column(String(16), nullable=False)
    public_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
