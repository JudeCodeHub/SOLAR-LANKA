"""Support cases with equipment links and private attachments."""

import sqlalchemy as sa
from alembic import op

revision = "0049_support_cases"
down_revision = "0048_troubleshooting_references"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_cases",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("installation_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid()),
        sa.Column("symptom", sa.Text(), nullable=False),
        sa.Column("observed_code", sa.String(64)),
        sa.Column("unsafe_now", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["installation_id"], ["installations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('open', 'in_progress', 'resolved', 'closed')", name="ck_support_status"
        ),
        sa.CheckConstraint("length(trim(symptom)) > 0", name="ck_support_symptom"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_cases_customer_id", "support_cases", ["customer_id"])
    op.create_index("ix_support_cases_company_status", "support_cases", ["company_id", "status"])
    op.create_table(
        "support_case_attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["case_id"], ["support_cases.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["asset_id"], ["media_assets.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asset_id", name="uq_support_attachment_asset"),
    )
    op.create_index("ix_support_case_attachments_case_id", "support_case_attachments", ["case_id"])


def downgrade() -> None:
    op.drop_index("ix_support_case_attachments_case_id", table_name="support_case_attachments")
    op.drop_table("support_case_attachments")
    op.drop_index("ix_support_cases_company_status", table_name="support_cases")
    op.drop_index("ix_support_cases_customer_id", table_name="support_cases")
    op.drop_table("support_cases")
