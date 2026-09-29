"""Track dispatch separately from processing and deduplicate notifications."""

import sqlalchemy as sa
from alembic import op

revision = "0038_inngest_delivery"
down_revision = "0037_workflow_outbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("outbox_events", sa.Column("dispatched_at", sa.DateTime(timezone=True)))
    op.add_column("notifications", sa.Column("dedupe_key", sa.String(255)))
    op.create_unique_constraint("uq_notifications_dedupe_key", "notifications", ["dedupe_key"])


def downgrade() -> None:
    op.drop_constraint("uq_notifications_dedupe_key", "notifications", type_="unique")
    op.drop_column("notifications", "dedupe_key")
    op.drop_column("outbox_events", "dispatched_at")
