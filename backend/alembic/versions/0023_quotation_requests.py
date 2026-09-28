"""Create customer quotation requests and per-company delivery records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0023_quotation_requests"
down_revision = "0022_saved_estimates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quotation_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "saved_estimate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("saved_estimates.id", ondelete="RESTRICT"),
        ),
        sa.Column("requirements", JSONB(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="submitted"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "jsonb_typeof(requirements) = 'object' AND requirements <> '{}'::jsonb",
            name="ck_quotation_requests_requirements",
        ),
        sa.CheckConstraint(
            "status IN ('submitted', 'closed', 'cancelled')",
            name="ck_quotation_requests_status",
        ),
    )
    op.create_index("ix_quotation_requests_customer_id", "quotation_requests", ["customer_id"])
    op.create_table(
        "request_deliveries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "request_id",
            UUID(as_uuid=True),
            sa.ForeignKey("quotation_requests.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="submitted"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("viewed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("request_id", "company_id", name="uq_request_delivery_company"),
        sa.CheckConstraint(
            "status IN ('submitted', 'viewed', 'responding', 'closed', 'cancelled')",
            name="ck_request_deliveries_status",
        ),
    )
    op.create_index(
        "ix_request_deliveries_company_status", "request_deliveries", ["company_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_request_deliveries_company_status", table_name="request_deliveries")
    op.drop_table("request_deliveries")
    op.drop_index("ix_quotation_requests_customer_id", table_name="quotation_requests")
    op.drop_table("quotation_requests")
