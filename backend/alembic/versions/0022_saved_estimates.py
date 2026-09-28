"""Persist customer-owned input, configuration, and result snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0022_saved_estimates"
down_revision = "0021_estimator_config_immutable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_estimates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "config_version_id",
            UUID(as_uuid=True),
            sa.ForeignKey("estimator_config_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("input_snapshot", JSONB(), nullable=False),
        sa.Column("configuration_snapshot", JSONB(), nullable=False),
        sa.Column("result_snapshot", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "jsonb_typeof(input_snapshot) = 'object' AND input_snapshot <> '{}'::jsonb",
            name="ck_saved_estimates_inputs",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(configuration_snapshot) = 'object' "
            "AND configuration_snapshot ?& ARRAY['assumptions', 'source_metadata', "
            "'scenario', 'version', 'published_at']",
            name="ck_saved_estimates_configuration",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(result_snapshot) = 'object' "
            "AND result_snapshot ?& ARRAY['sizing', 'financial', 'sources']",
            name="ck_saved_estimates_result",
        ),
    )
    op.create_index("ix_saved_estimates_user_id", "saved_estimates", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_estimates_user_id", table_name="saved_estimates")
    op.drop_table("saved_estimates")
