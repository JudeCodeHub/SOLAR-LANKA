"""Add local users keyed by Clerk subject."""

import sqlalchemy as sa
from alembic import op

revision = "0002_app_users"
down_revision = "0001_initial_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("clerk_subject", sa.String(255), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clerk_subject", name="uq_app_users_clerk_subject"),
    )


def downgrade() -> None:
    op.drop_table("app_users")
