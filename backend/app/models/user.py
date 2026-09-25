"""Local identity records; clerk_subject must come from verified token claims."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class AppUser(Base):
    """Link an application identity to Clerk without storing authentication secrets."""

    __tablename__ = "app_users"
    __table_args__ = (UniqueConstraint("clerk_subject", name="uq_app_users_clerk_subject"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    clerk_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
