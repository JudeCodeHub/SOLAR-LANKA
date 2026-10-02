"""A customer's request for a site visit, with explicit preferred time slots."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class SiteVisit(Base):
    __tablename__ = "site_visits"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested', 'alternatives_offered', 'confirmed', "
            "'cancelled', 'completed')",
            name="ck_site_visits_status",
        ),
        # One visit waiting for an answer per installation.
        Index(
            "uq_site_visits_one_open",
            "installation_id",
            unique=True,
            postgresql_where=text("status IN ('requested', 'alternatives_offered')"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    installation_id: Mapped[UUID] = mapped_column(
        ForeignKey("installations.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    requested_by: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="requested")
    # The IANA zone the customer's slots are meant in; instants are stored in UTC.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    technician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT")
    )
    confirmed_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SiteVisitSlot(Base):
    __tablename__ = "site_visit_slots"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_site_visit_slots_order"),
        CheckConstraint("position BETWEEN 1 AND 3", name="ck_site_visit_slots_position"),
        CheckConstraint("kind IN ('preferred', 'proposed')", name="ck_site_visit_slots_kind"),
        UniqueConstraint("visit_id", "kind", "position", name="uq_site_visit_slots_position"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    visit_id: Mapped[UUID] = mapped_column(
        ForeignKey("site_visits.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # Preferred slots come from the customer, proposed ones from the company.
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default="preferred")
    position: Mapped[int] = mapped_column(nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SiteVisitEvent(Base):
    """Who did what to a visit, in order; never edited."""

    __tablename__ = "site_visit_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    visit_id: Mapped[UUID] = mapped_column(
        ForeignKey("site_visits.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    actor_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str] = mapped_column(String(24), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.clock_timestamp()
    )
