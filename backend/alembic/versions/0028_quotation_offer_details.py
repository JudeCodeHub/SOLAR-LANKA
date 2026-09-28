"""Add draft capacity, warranty, exclusions, validity, and notes."""

import sqlalchemy as sa
from alembic import op

revision = "0028_quotation_offer_details"
down_revision = "0027_quotation_draft_terms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotation_revisions", sa.Column("capacity_kwp", sa.Numeric(10, 3)))
    op.add_column("quotation_revisions", sa.Column("warranty_terms", sa.Text()))
    op.add_column("quotation_revisions", sa.Column("exclusions", sa.Text()))
    op.add_column("quotation_revisions", sa.Column("validity_days", sa.Integer()))
    op.add_column("quotation_revisions", sa.Column("notes", sa.Text()))
    op.create_check_constraint(
        "ck_quotation_capacity_kwp", "quotation_revisions", "capacity_kwp > 0"
    )
    op.create_check_constraint(
        "ck_quotation_validity_days", "quotation_revisions", "validity_days BETWEEN 1 AND 90"
    )
    op.create_check_constraint(
        "ck_quotation_warranty_terms",
        "quotation_revisions",
        "length(trim(warranty_terms)) BETWEEN 1 AND 2000",
    )
    op.create_check_constraint(
        "ck_quotation_exclusions",
        "quotation_revisions",
        "length(trim(exclusions)) BETWEEN 1 AND 2000",
    )
    op.create_check_constraint("ck_quotation_notes", "quotation_revisions", "length(notes) <= 4000")


def downgrade() -> None:
    for name in (
        "ck_quotation_notes",
        "ck_quotation_exclusions",
        "ck_quotation_warranty_terms",
        "ck_quotation_validity_days",
        "ck_quotation_capacity_kwp",
    ):
        op.drop_constraint(name, "quotation_revisions", type_="check")
    for column in ("notes", "validity_days", "exclusions", "warranty_terms", "capacity_kwp"):
        op.drop_column("quotation_revisions", column)
