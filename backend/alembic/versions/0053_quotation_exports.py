"""Quotation export jobs."""

import sqlalchemy as sa
from alembic import op

revision = "0053_quotation_exports"
down_revision = "0052_article_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quotation_exports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("revision_id", sa.Uuid(), nullable=False),
        sa.Column("requester_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("file_id", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ready_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["revision_id"], ["quotation_revisions.id"], name="fk_quotation_exports_revision", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["requester_id"], ["app_users.id"], name="fk_quotation_exports_requester", ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("revision_id", "requester_id", name="uq_quotation_exports_revision_user"),
        sa.CheckConstraint("status IN ('pending', 'ready')", name="ck_quotation_exports_status"),
        sa.CheckConstraint("(status = 'ready') = (file_id IS NOT NULL)", name="ck_quotation_exports_file"),
    )


def downgrade() -> None:
    op.drop_table("quotation_exports")
