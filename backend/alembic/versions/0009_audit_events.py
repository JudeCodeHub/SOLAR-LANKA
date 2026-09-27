"""Store minimal audit events for sensitive company changes."""

import sqlalchemy as sa
from alembic import op

revision = "0009_audit_events"
down_revision = "0008_company_reviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "actor_id",
            sa.Uuid(),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_audit_events_company_id", "audit_events", ["company_id"])


def downgrade() -> None:
    op.drop_table("audit_events")
