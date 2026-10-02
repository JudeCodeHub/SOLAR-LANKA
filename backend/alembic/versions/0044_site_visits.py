"""Site visit requests with explicit preferred slots."""

import sqlalchemy as sa
from alembic import op

revision = "0044_site_visits"
down_revision = "0043_installation_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_visits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("installation_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["installation_id"], ["installations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["requested_by"], ["app_users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('requested', 'confirmed', 'cancelled', 'completed')",
            name="ck_site_visits_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_visits_installation_id", "site_visits", ["installation_id"])
    op.create_index(
        "uq_site_visits_one_requested",
        "site_visits",
        ["installation_id"],
        unique=True,
        postgresql_where=sa.text("status = 'requested'"),
    )
    op.create_table(
        "site_visit_slots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("visit_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["visit_id"], ["site_visits.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_site_visit_slots_order"),
        sa.CheckConstraint("position BETWEEN 1 AND 3", name="ck_site_visit_slots_position"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_visit_slots_visit_id", "site_visit_slots", ["visit_id"])


def downgrade() -> None:
    op.drop_index("ix_site_visit_slots_visit_id", table_name="site_visit_slots")
    op.drop_table("site_visit_slots")
    op.drop_index("uq_site_visits_one_requested", table_name="site_visits")
    op.drop_index("ix_site_visits_installation_id", table_name="site_visits")
    op.drop_table("site_visits")
