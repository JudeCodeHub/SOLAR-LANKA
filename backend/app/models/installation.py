"""Installations retain the exact accepted quotation revision."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class Installation(Base):
    __tablename__ = "installations"
    __table_args__ = (
        UniqueConstraint("accepted_revision_id", name="uq_installations_accepted_revision"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    accepted_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("quotation_revisions.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
