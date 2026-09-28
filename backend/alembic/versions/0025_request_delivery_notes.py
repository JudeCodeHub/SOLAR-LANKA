"""Persist private follow-up notes for one recipient delivery."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0025_request_delivery_notes"
down_revision = "0024_request_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "request_delivery_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "delivery_id", UUID(as_uuid=True),
            sa.ForeignKey("request_deliveries.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column(
            "author_id", UUID(as_uuid=True),
            sa.ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "length(trim(body)) BETWEEN 1 AND 4000", name="ck_request_delivery_notes_body"
        ),
    )
    op.create_index(
        "ix_request_delivery_notes_order", "request_delivery_notes",
        ["delivery_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_request_delivery_notes_order", table_name="request_delivery_notes")
    op.drop_table("request_delivery_notes")
