"""One-time technician invite codes."""

import sqlalchemy as sa
from alembic import op

revision = "0056_company_invites"
down_revision = "0055_notification_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_invites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(32), nullable=False, server_default="technician"),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("code_hint", sa.String(8), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("used_by", sa.Uuid()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name="fk_company_invites_company", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["app_users.id"], name="fk_company_invites_creator", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["used_by"], ["app_users.id"], name="fk_company_invites_user", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("code_hash", name="uq_company_invites_code_hash"),
        sa.CheckConstraint("role = 'technician'", name="ck_company_invites_role"),
    )
    op.create_index("ix_company_invites_company_id", "company_invites", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_company_invites_company_id", table_name="company_invites")
    op.drop_table("company_invites")
