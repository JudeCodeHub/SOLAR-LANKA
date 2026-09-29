"""Allow platform account audit records without a company."""

from alembic import op

revision = "0039_platform_account_audit"
down_revision = "0038_inngest_delivery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("audit_events", "company_id", nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM audit_events WHERE company_id IS NULL")
    op.alter_column("audit_events", "company_id", nullable=False)
