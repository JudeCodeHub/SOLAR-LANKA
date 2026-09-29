"""Company-only installation notes, isolated from shared progress history."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class InstallationInternalNote(Base):
    __tablename__ = "installation_internal_notes"
    __table_args__ = (Index("ix_installation_internal_notes_installation", "installation_id"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    installation_id: Mapped[UUID] = mapped_column(
        ForeignKey("installations.id", ondelete="RESTRICT"), nullable=False
    )
    actor_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
