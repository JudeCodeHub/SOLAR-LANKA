"""Create ordered installation milestones and backfill existing installations."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

from app.core.installation_milestones import SEQUENCE

revision = "0032_installation_milestones"
down_revision = "0031_one_winner_per_request"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installation_milestones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "installation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("installations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("position BETWEEN 1 AND 8", name="ck_installation_milestones_position"),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'completed')",
            name="ck_installation_milestones_status",
        ),
        sa.UniqueConstraint(
            "installation_id", "position", name="uq_installation_milestone_position"
        ),
        sa.UniqueConstraint("installation_id", "kind", name="uq_installation_milestone_kind"),
    )
    for position, milestone in enumerate(SEQUENCE, start=1):
        op.execute(
            sa.text(
                "INSERT INTO installation_milestones "
                "(id, installation_id, position, kind, status) "
                "SELECT gen_random_uuid(), id, :position, :kind, :status FROM installations"
            ).bindparams(
                position=position,
                kind=milestone.value,
                status="in_progress" if position == 1 else "pending",
            )
        )


def downgrade() -> None:
    op.drop_table("installation_milestones")
