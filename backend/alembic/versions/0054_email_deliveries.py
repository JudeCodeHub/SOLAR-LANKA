"""Email delivery records."""

import sqlalchemy as sa
from alembic import op

revision = "0054_email_deliveries"
down_revision = "0053_quotation_exports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recipient_id", sa.Uuid(), nullable=False),
        sa.Column("dedupe_key", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["app_users.id"],
            name="fk_email_deliveries_recipient",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("dedupe_key", name="uq_email_deliveries_dedupe_key"),
    )


def downgrade() -> None:
    op.drop_table("email_deliveries")
