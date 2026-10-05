"""Notification preferences."""

import sqlalchemy as sa
from alembic import op

revision = "0055_notification_preferences"
down_revision = "0054_email_deliveries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("reminders_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app_users.id"],
            name="fk_notification_preferences_user",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("notification_preferences")
