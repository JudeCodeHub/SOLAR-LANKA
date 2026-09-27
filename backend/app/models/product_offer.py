"""Company commercial offers, kept separate from canonical product specifications."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class ProductOffer(Base):
    __tablename__ = "product_offers"
    __table_args__ = (
        UniqueConstraint("company_id", "product_id", name="uq_product_offers_company_product"),
        CheckConstraint("indicative_price >= 0", name="ck_product_offers_price"),
        CheckConstraint(
            "(indicative_price IS NULL AND currency IS NULL) OR "
            "(indicative_price IS NOT NULL AND currency ~ '^[A-Z]{3}$')",
            name="ck_product_offers_price_currency",
        ),
        CheckConstraint("claim_label = 'company_declared'", name="ck_product_offers_claim_label"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    indicative_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    currency: Mapped[str | None] = mapped_column(String(3))
    is_demo_price: Mapped[bool] = mapped_column(
        nullable=False, server_default="false", default=False
    )
    company_claim: Mapped[str | None] = mapped_column(Text)
    claim_label: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="company_declared", default="company_declared"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
