"""Specification provenance retained independently for each source retrieval."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class ProductSource(Base):
    __tablename__ = "product_sources"
    __table_args__ = (
        CheckConstraint("length(trim(source_url)) > 0", name="ck_product_sources_url"),
        CheckConstraint(
            "jsonb_typeof(specifications) = 'object' AND specifications <> '{}'::jsonb",
            name="ck_product_sources_specifications",
        ),
        CheckConstraint("verified_at >= retrieved_at", name="ck_product_sources_dates"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_title: Mapped[str | None] = mapped_column(Text)
    specifications: Mapped[dict] = mapped_column(JSONB, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
