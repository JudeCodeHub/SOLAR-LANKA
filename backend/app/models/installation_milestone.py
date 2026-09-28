"""Ordered installation milestones initialised with an accepted quotation."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class InstallationMilestoneRecord(Base):
    __tablename__ = "installation_milestones"
    __table_args__ = (
        CheckConstraint("position BETWEEN 1 AND 8", name="ck_installation_milestones_position"),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed')",
            name="ck_installation_milestones_status",
        ),
        UniqueConstraint("installation_id", "position", name="uq_installation_milestone_position"),
        UniqueConstraint("installation_id", "kind", name="uq_installation_milestone_kind"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    installation_id: Mapped[UUID] = mapped_column(
        ForeignKey("installations.id", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
