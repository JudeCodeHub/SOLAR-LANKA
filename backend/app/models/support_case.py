"""A customer support request about their installation, scoped to the installing company."""

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


class SupportCase(Base):
    __tablename__ = "support_cases"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open', 'in_progress', 'resolved', 'closed')", name="ck_support_status"
        ),
        CheckConstraint("length(trim(symptom)) > 0", name="ck_support_symptom"),
        Index("ix_support_cases_company_status", "company_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # The company that installed the system; it is the only company that ever sees the case.
    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    installation_id: Mapped[UUID] = mapped_column(
        ForeignKey("installations.id", ondelete="RESTRICT"), nullable=False
    )
    # The exact equipment the problem is about, when the customer knows it.
    product_id: Mapped[UUID | None] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    symptom: Mapped[str] = mapped_column(Text, nullable=False)
    observed_code: Mapped[str | None] = mapped_column(String(64))
    # The customer says it may be dangerous now (smell of burning, sparks, heat, water).
    unsafe_now: Mapped[bool] = mapped_column(nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SupportCaseAttachment(Base):
    """A private photo attached to a case; the file is a private media asset."""

    __tablename__ = "support_case_attachments"
    __table_args__ = (UniqueConstraint("asset_id", name="uq_support_attachment_asset"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    case_id: Mapped[UUID] = mapped_column(
        ForeignKey("support_cases.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    asset_id: Mapped[UUID] = mapped_column(
        ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
