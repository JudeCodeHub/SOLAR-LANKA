"""Assign technicians to installations; a technician sees only what is assigned to them."""

import sqlalchemy as sa
from alembic import op

revision = "0043_installation_assignments"
down_revision = "0042_company_listing_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installation_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("installation_id", sa.Uuid(), nullable=False),
        sa.Column("technician_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_by", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["installation_id"], ["installations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["technician_id"], ["app_users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_by"], ["app_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "installation_id", "technician_id", name="uq_installation_assignments_pair"
        ),
    )
    op.create_index(
        "ix_installation_assignments_installation_id",
        "installation_assignments",
        ["installation_id"],
    )
    op.create_index(
        "ix_installation_assignments_technician_id",
        "installation_assignments",
        ["technician_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_installation_assignments_technician_id", table_name="installation_assignments"
    )
    op.drop_index(
        "ix_installation_assignments_installation_id", table_name="installation_assignments"
    )
    op.drop_table("installation_assignments")
