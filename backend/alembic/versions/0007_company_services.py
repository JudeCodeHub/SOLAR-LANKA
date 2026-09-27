"""Company service coverage and explicitly declared credentials."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_company_services"
down_revision = "0006_companies_memberships"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name in ("service_districts", "services", "declared_credentials"):
        op.add_column(
            "companies",
            sa.Column(
                name, postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")
            ),
        )


def downgrade() -> None:
    for name in ("declared_credentials", "services", "service_districts"):
        op.drop_column("companies", name)
