"""Create companies and explicit company memberships."""

import sqlalchemy as sa
from alembic import op

revision = "0006_companies_memberships"
down_revision = "0005_lifecycle_sync"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("publication_status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_companies_name"),
        sa.CheckConstraint(
            "publication_status IN ('draft', 'pending', 'approved', 'rejected')",
            name="ck_companies_publication_status",
        ),
    )
    op.create_table(
        "company_memberships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("user_id", "company_id", name="uq_company_memberships_user_company"),
        sa.CheckConstraint(
            "role IN ('company_admin', 'sales', 'technician')", name="ck_company_memberships_role"
        ),
        sa.CheckConstraint(
            "status IN ('active', 'suspended')", name="ck_company_memberships_status"
        ),
    )
    op.create_index("ix_company_memberships_company_id", "company_memberships", ["company_id"])


def downgrade() -> None:
    op.drop_table("company_memberships")
    op.drop_table("companies")
