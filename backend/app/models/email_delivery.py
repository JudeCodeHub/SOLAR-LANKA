"""One row per email sent, so a retried job never sends the same message twice."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class EmailDelivery(Base):
    __tablename__ = "email_deliveries"
    __table_args__ = (UniqueConstraint("dedupe_key", name="uq_email_deliveries_dedupe_key"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    recipient_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    dedupe_key: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
