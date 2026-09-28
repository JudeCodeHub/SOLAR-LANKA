"""Customer-owned, immutable historical estimate snapshots."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class SavedEstimate(Base):
    __tablename__ = "saved_estimates"
    __table_args__ = (
        CheckConstraint(
            "jsonb_typeof(input_snapshot) = 'object' AND input_snapshot <> '{}'::jsonb",
            name="ck_saved_estimates_inputs",
        ),
        CheckConstraint(
            "jsonb_typeof(configuration_snapshot) = 'object' "
            "AND configuration_snapshot ?& ARRAY['assumptions', 'source_metadata', "
            "'scenario', 'version', 'published_at']",
            name="ck_saved_estimates_configuration",
        ),
        CheckConstraint(
            "jsonb_typeof(result_snapshot) = 'object' "
            "AND result_snapshot ?& ARRAY['sizing', 'financial', 'sources']",
            name="ck_saved_estimates_result",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    config_version_id: Mapped[UUID] = mapped_column(
        ForeignKey("estimator_config_versions.id", ondelete="RESTRICT"), nullable=False
    )
    input_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    configuration_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    result_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
