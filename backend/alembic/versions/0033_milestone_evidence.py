"""Retain verified evidence references when milestones complete."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0033_milestone_evidence"
down_revision = "0032_installation_milestones"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "installation_milestones",
        sa.Column("evidence_refs", JSONB(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("installation_milestones", "evidence_refs")
