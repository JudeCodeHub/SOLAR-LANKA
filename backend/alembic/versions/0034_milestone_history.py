"""Store actor-attributed milestone transitions and schedule updates."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0034_milestone_history"
down_revision = "0033_milestone_evidence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installation_milestone_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "milestone_id",
            UUID(as_uuid=True),
            sa.ForeignKey("installation_milestones.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(16), nullable=False),
        sa.Column("to_status", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("delay_until", sa.DateTime(timezone=True)),
        sa.Column("next_action", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_installation_milestone_events_milestone_id",
        "installation_milestone_events",
        ["milestone_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_installation_milestone_events_milestone_id", table_name="installation_milestone_events"
    )
    op.drop_table("installation_milestone_events")
