"""A customer's request for a site visit, with explicit preferred time slots."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class SiteVisit(Base):
    __tablename__ = "site_visits"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested', 'confirmed', 'cancelled', 'completed')",
            name="ck_site_visits_status",
        ),
        # One open request per installation; confirming and rescheduling come in the next step.
        Index(
            "uq_site_visits_one_requested",
            "installation_id",
            unique=True,
            postgresql_where=text("status = 'requested'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    installation_id: Mapped[UUID] = mapped_column(
        ForeignKey("installations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    requested_by: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="requested")
    # The IANA zone the customer's slots are meant in; instants are stored in UTC.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SiteVisitSlot(Base):
    __tablename__ = "site_visit_slots"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_site_visit_slots_order"),
        CheckConstraint("position BETWEEN 1 AND 3", name="ck_site_visit_slots_position"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    visit_id: Mapped[UUID] = mapped_column(
        ForeignKey("site_visits.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
