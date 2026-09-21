"""Establish the migration baseline before domain tables are implemented.

Alembic creates its version table and records this revision. Domain tables are
introduced by their feature migrations; this baseline deliberately creates none.
"""

revision: str = "0001_initial_baseline"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Record the baseline without introducing speculative domain tables."""


def downgrade() -> None:
    """Remove the baseline revision marker; there are no domain objects to undo."""
