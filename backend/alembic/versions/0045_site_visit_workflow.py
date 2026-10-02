"""Site visit confirmation, alternatives, cancellation and rescheduling with an event history."""

import sqlalchemy as sa
from alembic import op

revision = "0045_site_visit_workflow"
down_revision = "0044_site_visits"
branch_labels = None
depends_on = None

OLD = "status IN ('requested', 'confirmed', 'cancelled', 'completed')"
NEW = "status IN ('requested', 'alternatives_offered', 'confirmed', 'cancelled', 'completed')"


def upgrade() -> None:
    op.alter_column("site_visits", "status", type_=sa.String(24), existing_nullable=False)
    op.drop_constraint("ck_site_visits_status", "site_visits", type_="check")
    op.create_check_constraint("ck_site_visits_status", "site_visits", NEW)
    op.drop_index("uq_site_visits_one_requested", table_name="site_visits")
    op.create_index(
        "uq_site_visits_one_open",
        "site_visits",
        ["installation_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('requested', 'alternatives_offered')"),
    )
    op.add_column("site_visits", sa.Column("technician_id", sa.Uuid()))
    op.add_column("site_visits", sa.Column("confirmed_starts_at", sa.DateTime(timezone=True)))
    op.add_column("site_visits", sa.Column("confirmed_ends_at", sa.DateTime(timezone=True)))
    op.create_foreign_key(
        "fk_site_visits_technician",
        "site_visits",
        "app_users",
        ["technician_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        "site_visit_slots",
        sa.Column("kind", sa.String(16), nullable=False, server_default="preferred"),
    )
    op.alter_column("site_visit_slots", "kind", server_default=None)
    op.create_check_constraint(
        "ck_site_visit_slots_kind", "site_visit_slots", "kind IN ('preferred', 'proposed')"
    )
    op.create_unique_constraint(
        "uq_site_visit_slots_position", "site_visit_slots", ["visit_id", "kind", "position"]
    )
    op.create_table(
        "site_visit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("from_status", sa.String(24)),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("reason", sa.Text()),
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
    op.create_index("ix_site_visit_events_visit_id", "site_visit_events", ["visit_id"])


def downgrade() -> None:
    op.drop_index("ix_site_visit_events_visit_id", table_name="site_visit_events")
    op.drop_table("site_visit_events")
    op.drop_constraint("uq_site_visit_slots_position", "site_visit_slots", type_="unique")
    op.drop_constraint("ck_site_visit_slots_kind", "site_visit_slots", type_="check")
    op.drop_column("site_visit_slots", "kind")
    op.drop_constraint("fk_site_visits_technician", "site_visits", type_="foreignkey")
    op.drop_column("site_visits", "confirmed_ends_at")
    op.drop_column("site_visits", "confirmed_starts_at")
    op.drop_column("site_visits", "technician_id")
    op.drop_index("uq_site_visits_one_open", table_name="site_visits")
    op.create_index(
        "uq_site_visits_one_requested",
        "site_visits",
        ["installation_id"],
        unique=True,
        postgresql_where=sa.text("status = 'requested'"),
    )
    op.drop_constraint("ck_site_visits_status", "site_visits", type_="check")
    op.create_check_constraint("ck_site_visits_status", "site_visits", OLD)
    op.alter_column("site_visits", "status", type_=sa.String(16), existing_nullable=False)
