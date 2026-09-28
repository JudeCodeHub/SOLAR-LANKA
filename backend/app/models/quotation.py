"""One company quotation per recipient delivery, with numbered revisions and lines."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class Quotation(Base):
    __tablename__ = "quotations"
    __table_args__ = (UniqueConstraint("delivery_id", name="uq_quotations_delivery"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    delivery_id: Mapped[UUID] = mapped_column(
        ForeignKey("request_deliveries.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class QuotationRevision(Base):
    __tablename__ = "quotation_revisions"
    __table_args__ = (
        UniqueConstraint("quotation_id", "revision_number", name="uq_quotation_revision_number"),
        CheckConstraint("revision_number > 0", name="ck_quotation_revision_number"),
        CheckConstraint(
            "status IN ('draft', 'sent', 'revised', 'accepted', 'declined', "
            "'expired', 'withdrawn')",
            name="ck_quotation_revision_status",
        ),
        CheckConstraint(
            "(sent_at IS NULL AND valid_until IS NULL) OR "
            "(sent_at IS NOT NULL AND valid_until > sent_at AND "
            "valid_until <= sent_at + INTERVAL '90 days')",
            name="ck_quotation_revision_validity",
        ),
        CheckConstraint(
            "discount_kind IN ('none', 'fixed', 'percent')", name="ck_quotation_discount_kind"
        ),
        CheckConstraint("discount_value >= 0", name="ck_quotation_discount_value"),
        CheckConstraint("tax_rate_percent BETWEEN 0 AND 100", name="ck_quotation_tax_rate"),
        Index("ix_quotation_revisions_quotation_created", "quotation_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    quotation_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotations.id", ondelete="RESTRICT"), nullable=False
    )
    revision_number: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="LKR")
    discount_kind: Mapped[str] = mapped_column(
        String(8), nullable=False, default="none", server_default="none"
    )
    discount_value: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    tax_rate_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0.00"), server_default="0.00"
    )
    subtotal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    discount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    tax: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    total: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class QuotationLineItem(Base):
    __tablename__ = "quotation_line_items"
    __table_args__ = (
        UniqueConstraint("revision_id", "position", name="uq_quotation_line_position"),
        CheckConstraint("position > 0", name="ck_quotation_line_position"),
        CheckConstraint("quantity > 0", name="ck_quotation_line_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_quotation_line_unit_price"),
        CheckConstraint("line_total >= 0", name="ck_quotation_line_total"),
        CheckConstraint(
            "(kind = 'equipment' AND product_id IS NOT NULL) OR "
            "(kind = 'charge' AND product_id IS NULL)",
            name="ck_quotation_line_kind_product",
        ),
        Index("ix_quotation_line_items_revision", "revision_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotation_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, server_default="charge")
    product_id: Mapped[UUID | None] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    line_total: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
