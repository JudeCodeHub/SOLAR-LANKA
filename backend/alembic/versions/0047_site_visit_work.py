"""Visit completion details, working notes and private visit evidence."""

import sqlalchemy as sa
from alembic import op

revision = "0047_site_visit_work"
down_revision = "0046_site_visit_overlap"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("site_visits", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.add_column("site_visits", sa.Column("completed_by", sa.Uuid()))
    op.add_column("site_visits", sa.Column("completion_summary", sa.Text()))
    op.create_foreign_key(
        "fk_site_visits_completed_by",
        "site_visits",
        "app_users",
        ["completed_by"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_check_constraint(
        "ck_site_visits_completion",
        "site_visits",
        "(status = 'completed') = (completed_at IS NOT NULL AND completed_by IS NOT NULL)",
    )
    op.create_table(
        "site_visit_notes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["visit_id"], ["site_visits.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_visit_notes_visit_id", "site_visit_notes", ["visit_id"])
    op.create_table(
        "site_visit_evidence",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["visit_id"], ["site_visits.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["asset_id"], ["media_assets.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asset_id", name="uq_site_visit_evidence_asset"),
    )
    op.create_index("ix_site_visit_evidence_visit_id", "site_visit_evidence", ["visit_id"])


def downgrade() -> None:
    op.drop_index("ix_site_visit_evidence_visit_id", table_name="site_visit_evidence")
    op.drop_table("site_visit_evidence")
    op.drop_index("ix_site_visit_notes_visit_id", table_name="site_visit_notes")
    op.drop_table("site_visit_notes")
    op.drop_constraint("ck_site_visits_completion", "site_visits", type_="check")
    op.drop_constraint("fk_site_visits_completed_by", "site_visits", type_="foreignkey")
    op.drop_column("site_visits", "completion_summary")
    op.drop_column("site_visits", "completed_by")
    op.drop_column("site_visits", "completed_at")
