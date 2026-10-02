"""Support case assignments and an ordered update history with replay-safe keys."""

import sqlalchemy as sa
from alembic import op

revision = "0050_support_case_work"
down_revision = "0049_support_cases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_case_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("technician_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["case_id"], ["support_cases.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technician_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_by"], ["app_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_id", "technician_id", name="uq_support_assignment_pair"),
    )
    op.create_index("ix_support_case_assignments_case_id", "support_case_assignments", ["case_id"])
    op.create_index(
        "ix_support_case_assignments_technician_id", "support_case_assignments", ["technician_id"]
    )
    op.create_table(
        "support_case_updates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("case_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("actor_role", sa.String(16), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("from_status", sa.String(16)),
        sa.Column("to_status", sa.String(16)),
        sa.Column("body", sa.Text()),
        sa.Column("shared", sa.Boolean(), nullable=False),
        sa.Column("subject_id", sa.Uuid()),
        sa.Column("idempotency_key", sa.Uuid()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["case_id"], ["support_cases.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["subject_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "kind IN ('message', 'status', 'assigned', 'unassigned')", name="ck_support_update_kind"
        ),
        sa.CheckConstraint(
            "actor_role IN ('customer', 'staff', 'technician')", name="ck_support_update_role"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_support_case_updates_case_id", "support_case_updates", ["case_id"])
    op.create_index(
        "uq_support_update_idempotency",
        "support_case_updates",
        ["case_id", "actor_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_support_update_idempotency", table_name="support_case_updates")
    op.drop_index("ix_support_case_updates_case_id", table_name="support_case_updates")
    op.drop_table("support_case_updates")
    op.drop_index(
        "ix_support_case_assignments_technician_id", table_name="support_case_assignments"
    )
    op.drop_index("ix_support_case_assignments_case_id", table_name="support_case_assignments")
    op.drop_table("support_case_assignments")
