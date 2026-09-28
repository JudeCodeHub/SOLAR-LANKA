"""Private staff follow-up notes attached to one company delivery."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class RequestDeliveryNote(Base):
    __tablename__ = "request_delivery_notes"
    __table_args__ = (
        CheckConstraint(
            "length(trim(body)) BETWEEN 1 AND 4000", name="ck_request_delivery_notes_body"
        ),
        Index("ix_request_delivery_notes_order", "delivery_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    delivery_id: Mapped[UUID] = mapped_column(
        ForeignKey("request_deliveries.id", ondelete="RESTRICT"), nullable=False
    )
    author_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
