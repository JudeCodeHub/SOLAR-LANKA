"""Sourced troubleshooting references, each tied to one exact product."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class TroubleshootingReference(Base):
    __tablename__ = "troubleshooting_references"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')", name="ck_troubleshooting_status"
        ),
        CheckConstraint(
            "safety_level IN ('safe_observation', 'hazard')", name="ck_troubleshooting_safety"
        ),
        CheckConstraint(
            "jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 10",
            name="ck_troubleshooting_steps",
        ),
        # A hazard always carries its warning, so it can never be shown as routine advice.
        CheckConstraint(
            "safety_level <> 'hazard' OR length(trim(coalesce(hazard_warning, ''))) > 0",
            name="ck_troubleshooting_hazard_warning",
        ),
        # Nothing is published without a source and the date it was checked against it.
        CheckConstraint(
            "status <> 'published' OR (length(trim(source_url)) > 0 AND verified_on IS NOT NULL "
            "AND length(trim(source_title)) > 0)",
            name="ck_troubleshooting_published_sourced",
        ),
        Index("ix_troubleshooting_product_status", "product_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    # The code the equipment displays, when there is one; matched exactly.
    code: Mapped[str | None] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    steps: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    safety_level: Mapped[str] = mapped_column(String(24), nullable=False)
    hazard_warning: Mapped[str | None] = mapped_column(Text)
    source_title: Mapped[str] = mapped_column(String(300), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    source_page: Mapped[str | None] = mapped_column(String(64))
    verified_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Fictional demonstration content is always labelled as such.
    is_sample: Mapped[bool] = mapped_column(nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
