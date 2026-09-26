"""Persist provider revocations and webhook receipt IDs."""

import sqlalchemy as sa
from alembic import op

revision = "0005_lifecycle_sync"
down_revision = "0004_user_suspension"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_users",
        sa.Column("provider_state", sa.String(16), nullable=False, server_default="active"),
    )
    op.add_column(
        "app_users",
        sa.Column("provider_event_timestamp", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.create_table(
        "clerk_lifecycle_events",
        sa.Column("id", sa.String(255), primary_key=True),
        sa.Column(
            "received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("clerk_lifecycle_events")
    op.drop_column("app_users", "provider_event_timestamp")
    op.drop_column("app_users", "provider_state")
