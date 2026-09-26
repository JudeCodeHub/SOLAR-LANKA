"""Default application users to customer access."""

import sqlalchemy as sa
from alembic import op

revision = "0003_user_role"
down_revision = "0002_app_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "app_users", sa.Column("role", sa.String(32), nullable=False, server_default="customer")
    )
    op.create_check_constraint(
        "ck_app_users_role", "app_users", "role IN ('customer', 'platform_admin')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_app_users_role", "app_users", type_="check")
    op.drop_column("app_users", "role")
