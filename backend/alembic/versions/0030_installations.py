"""Create installations referencing an accepted quotation revision."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0030_installations"
down_revision = "0029_immutable_quote_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "accepted_revision_id", UUID(as_uuid=True),
            sa.ForeignKey("quotation_revisions.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "accepted_revision_id", name="uq_installations_accepted_revision"
        ),
    )


def downgrade() -> None:
    op.drop_table("installations")
