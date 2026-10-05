"""A person's own switches for reminders and email; no row means everything is on."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="CASCADE"), primary_key=True
    )
    reminders_enabled: Mapped[bool] = mapped_column(
        nullable=False, default=True, server_default=true()
    )
    email_enabled: Mapped[bool] = mapped_column(nullable=False, default=True, server_default=true())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
