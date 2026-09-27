"""Canonical products; commercial offers and prices belong in separate records."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("kind IN ('panel', 'inverter')", name="ck_products_kind"),
        CheckConstraint("length(trim(brand)) > 0", name="ck_products_brand"),
        CheckConstraint("length(trim(model)) > 0", name="ck_products_model"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    brand: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    image_urls: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    datasheet_urls: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    source_url: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
