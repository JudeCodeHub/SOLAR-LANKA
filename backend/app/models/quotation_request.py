"""Customer quotation requests and separately scoped company deliveries."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class QuotationRequest(Base):
    __tablename__ = "quotation_requests"
    __table_args__ = (
        CheckConstraint(
            "jsonb_typeof(requirements) = 'object' AND requirements <> '{}'::jsonb",
            name="ck_quotation_requests_requirements",
        ),
        CheckConstraint(
            "status IN ('submitted', 'closed', 'cancelled')",
            name="ck_quotation_requests_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    saved_estimate_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("saved_estimates.id", ondelete="RESTRICT")
    )
    requirements: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="submitted", server_default="submitted"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RequestDelivery(Base):
    __tablename__ = "request_deliveries"
    __table_args__ = (
        UniqueConstraint("request_id", "company_id", name="uq_request_delivery_company"),
        CheckConstraint(
            "status IN ('submitted', 'viewed', 'responding', 'closed', 'cancelled')",
            name="ck_request_deliveries_status",
        ),
        Index("ix_request_deliveries_company_status", "company_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotation_requests.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="submitted", server_default="submitted"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    viewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
