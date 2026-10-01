"""Index the company directory and review-queue listings by status and sort order."""

from alembic import op

revision = "0042_company_listing_indexes"
down_revision = "0041_archive_estimator_configs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Public directory: WHERE publication_status = 'approved' ORDER BY name, id.
    op.create_index("ix_companies_status_name", "companies", ["publication_status", "name", "id"])
    # Administrator review queue: WHERE publication_status = 'pending' ORDER BY created_at, id.
    op.create_index(
        "ix_companies_status_created", "companies", ["publication_status", "created_at", "id"]
    )


def downgrade() -> None:
    op.drop_index("ix_companies_status_created", table_name="companies")
    op.drop_index("ix_companies_status_name", table_name="companies")
