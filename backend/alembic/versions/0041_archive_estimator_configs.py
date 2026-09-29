"""Archive old estimator versions without deleting historical references."""

import sqlalchemy as sa
from alembic import op

revision = "0041_archive_estimator_configs"
down_revision = "0040_company_review_drafts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "estimator_config_versions",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("estimator_config_versions", "is_archived")
