"""Persist local account suspension state."""

import sqlalchemy as sa
from alembic import op

revision = "0004_user_suspension"
down_revision = "0003_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_users",
        sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("app_users", "is_suspended")
