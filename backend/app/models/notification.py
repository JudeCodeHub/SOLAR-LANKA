"""Recipient-owned in-app notification; delivery is added in later workflow steps."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_created", "recipient_id", "created_at", "id"),
        UniqueConstraint("dedupe_key", name="uq_notifications_dedupe_key"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    recipient_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    dedupe_key: Mapped[str | None] = mapped_column(String(255))
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    target_kind: Mapped[str | None] = mapped_column(String(64))
    target_id: Mapped[UUID | None] = mapped_column()
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
