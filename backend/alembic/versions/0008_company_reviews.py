"""Retain company submission and review history."""

import sqlalchemy as sa
from alembic import op

revision = "0008_company_reviews"
down_revision = "0007_company_services"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            sa.Uuid(),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "outcome IN ('submitted', 'approved', 'rejected')", name="ck_company_reviews_outcome"
        ),
    )
    op.create_index("ix_company_reviews_company_id", "company_reviews", ["company_id"])


def downgrade() -> None:
    op.drop_table("company_reviews")
