"""Inverter specifications; unknown values remain null, compatibility is never inferred."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Inverter(Base):
    __tablename__ = "inverters"
    __table_args__ = (
        CheckConstraint(
            "category IN ('on_grid', 'off_grid', 'hybrid')", name="ck_inverters_category"
        ),
        CheckConstraint("capacity_kw > 0", name="ck_inverters_capacity"),
        CheckConstraint("mppt_count >= 0", name="ck_inverters_mppt_count"),
        CheckConstraint("warranty_years >= 0", name="ck_inverters_warranty"),
        CheckConstraint(
            "compatibility_notes IS NULL OR "
            "(compatibility_source_url IS NOT NULL AND length(trim(compatibility_source_url)) > 0)",
            name="ck_inverters_compatibility_source",
        ),
    )

    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), primary_key=True
    )
    category: Mapped[str | None] = mapped_column(String(16))
    capacity_kw: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    mppt_count: Mapped[int | None] = mapped_column(Integer)
    connectivity: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    warranty_years: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    warranty_details: Mapped[str | None] = mapped_column(Text)
    compatibility_notes: Mapped[str | None] = mapped_column(Text)
    compatibility_source_url: Mapped[str | None] = mapped_column(Text)
    manual_urls: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    manufacturer_document_urls: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
    error_code_reference_urls: Mapped[list[str] | None] = mapped_column(JSONB(none_as_null=True))
