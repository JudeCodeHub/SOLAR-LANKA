"""A technician cannot hold two confirmed visits that overlap in time."""

from alembic import op

revision = "0046_site_visit_overlap"
down_revision = "0045_site_visit_workflow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Lets a GiST index compare plain uuids with = alongside the time range.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        "ALTER TABLE site_visits ADD CONSTRAINT ex_site_visits_technician_overlap "
        "EXCLUDE USING gist (technician_id WITH =, "
        "tstzrange(confirmed_starts_at, confirmed_ends_at) WITH &&) "
        "WHERE (status = 'confirmed')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE site_visits DROP CONSTRAINT ex_site_visits_technician_overlap")
