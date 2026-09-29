"""Keep installation internal notes separate from shared milestone events."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0035_installation_internal_notes"
down_revision = "0034_milestone_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installation_internal_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "installation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("installations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_installation_internal_notes_installation",
        "installation_internal_notes",
        ["installation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_installation_internal_notes_installation", table_name="installation_internal_notes"
    )
    op.drop_table("installation_internal_notes")
