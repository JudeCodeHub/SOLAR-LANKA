"""Persist versioned estimator assumptions with per-version source snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0020_estimator_config_versions"
down_revision = "0019_company_credential_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "estimator_config_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("scenario", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("assumptions", JSONB(), nullable=False),
        sa.Column("source_metadata", JSONB(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("scenario", "version", name="uq_estimator_config_scenario_version"),
        sa.CheckConstraint("version > 0", name="ck_estimator_config_version_positive"),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_estimator_config_status"),
        sa.CheckConstraint(
            "jsonb_typeof(assumptions) = 'object' AND assumptions <> '{}'::jsonb",
            name="ck_estimator_config_assumptions",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(source_metadata) = 'object' "
            "AND source_metadata ?& ARRAY['yield', 'tariff', 'cost'] "
            "AND jsonb_typeof(source_metadata->'yield') = 'object' "
            "AND jsonb_typeof(source_metadata->'tariff') = 'object' "
            "AND jsonb_typeof(source_metadata->'cost') = 'object'",
            name="ck_estimator_config_sources",
        ),
        sa.CheckConstraint(
            "(status = 'draft' AND published_at IS NULL) OR "
            "(status = 'published' AND published_at IS NOT NULL)",
            name="ck_estimator_config_publication",
        ),
    )


def downgrade() -> None:
    op.drop_table("estimator_config_versions")
