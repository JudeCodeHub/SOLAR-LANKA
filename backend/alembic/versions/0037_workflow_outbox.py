"""Persist workflow side effects atomically with business changes."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0037_workflow_outbox"
down_revision = "0036_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outbox_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_key", sa.String(200), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("aggregate_kind", sa.String(64), nullable=False),
        sa.Column("aggregate_id", UUID(as_uuid=True), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("event_key", name="uq_outbox_events_event_key"),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'delivered', 'failed')",
            name="ck_outbox_events_status",
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_outbox_events_attempts"),
    )
    op.create_index("ix_outbox_events_status_created", "outbox_events", ["status", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_outbox_events_status_created", table_name="outbox_events")
    op.drop_table("outbox_events")
