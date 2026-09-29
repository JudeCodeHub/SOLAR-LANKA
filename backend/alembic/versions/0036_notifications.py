"""Create recipient-owned notifications with read state."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0036_notifications"
down_revision = "0035_installation_internal_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "recipient_id",
            UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("target_kind", sa.String(64)),
        sa.Column("target_id", UUID(as_uuid=True)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_notifications_recipient_created",
        "notifications",
        ["recipient_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_created", table_name="notifications")
    op.drop_table("notifications")
