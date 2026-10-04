"""One exported document per customer and sent revision, produced by a retry-safe background job."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class QuotationExport(Base):
    __tablename__ = "quotation_exports"
    __table_args__ = (
        UniqueConstraint("revision_id", "requester_id", name="uq_quotation_exports_revision_user"),
        CheckConstraint("status IN ('pending', 'ready')", name="ck_quotation_exports_status"),
        CheckConstraint(
            "(status = 'ready') = (file_id IS NOT NULL)", name="ck_quotation_exports_file"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotation_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    requester_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    file_id: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
