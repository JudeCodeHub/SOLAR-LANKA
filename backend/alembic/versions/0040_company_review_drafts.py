"""Track review invalidation when a submitted profile changes."""

import sqlalchemy as sa
from alembic import op

revision = "0040_company_review_drafts"
down_revision = "0039_platform_account_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_company_reviews_outcome", "company_reviews", type_="check")
    op.alter_column("company_reviews", "outcome", type_=sa.String(24), existing_nullable=False)
    op.create_check_constraint(
        "ck_company_reviews_outcome",
        "company_reviews",
        "outcome IN ('submitted', 'approved', 'rejected', 'returned_to_draft')",
    )
    op.alter_column("company_reviews", "created_at", server_default=sa.text("clock_timestamp()"))


def downgrade() -> None:
    op.execute("DELETE FROM company_reviews WHERE outcome = 'returned_to_draft'")
    op.drop_constraint("ck_company_reviews_outcome", "company_reviews", type_="check")
    op.alter_column("company_reviews", "outcome", type_=sa.String(16), existing_nullable=False)
    op.create_check_constraint(
        "ck_company_reviews_outcome",
        "company_reviews",
        "outcome IN ('submitted', 'approved', 'rejected')",
    )
    op.alter_column("company_reviews", "created_at", server_default=sa.func.now())
