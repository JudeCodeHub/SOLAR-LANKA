"""Versioned estimator assumptions with a source snapshot per version."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class EstimatorConfigVersion(Base):
    __tablename__ = "estimator_config_versions"
    __table_args__ = (
        UniqueConstraint("scenario", "version", name="uq_estimator_config_scenario_version"),
        CheckConstraint("version > 0", name="ck_estimator_config_version_positive"),
        CheckConstraint("status IN ('draft', 'published')", name="ck_estimator_config_status"),
        CheckConstraint(
            "jsonb_typeof(assumptions) = 'object' AND assumptions <> '{}'::jsonb",
            name="ck_estimator_config_assumptions",
        ),
        CheckConstraint(
            "jsonb_typeof(source_metadata) = 'object' "
            "AND source_metadata ?& ARRAY['yield', 'tariff', 'cost'] "
            "AND jsonb_typeof(source_metadata->'yield') = 'object' "
            "AND jsonb_typeof(source_metadata->'tariff') = 'object' "
            "AND jsonb_typeof(source_metadata->'cost') = 'object'",
            name="ck_estimator_config_sources",
        ),
        CheckConstraint(
            "(status = 'draft' AND published_at IS NULL) OR "
            "(status = 'published' AND published_at IS NOT NULL)",
            name="ck_estimator_config_publication",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    scenario: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Each topic snapshot carries URL, publisher, review/effective dates, unit,
    # and limitations as applicable. Null numeric assumptions remain explicit.
    source_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
