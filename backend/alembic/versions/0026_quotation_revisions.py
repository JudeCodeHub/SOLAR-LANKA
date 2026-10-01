"""Create recipient-scoped quotations and versioned line items."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0026_quotation_revisions"
down_revision = "0025_request_delivery_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quotations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "delivery_id",
            UUID(as_uuid=True),
            sa.ForeignKey("request_deliveries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("delivery_id", name="uq_quotations_delivery"),
    )
    op.create_table(
        "quotation_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "quotation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("quotations.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("subtotal", sa.Numeric(18, 2)),
        sa.Column("discount", sa.Numeric(18, 2)),
        sa.Column("tax", sa.Numeric(18, 2)),
        sa.Column("total", sa.Numeric(18, 2)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("quotation_id", "revision_number", name="uq_quotation_revision_number"),
        sa.CheckConstraint("revision_number > 0", name="ck_quotation_revision_number"),
        sa.CheckConstraint(
            "status IN ('draft', 'sent', 'revised', 'accepted', 'declined', "
            "'expired', 'withdrawn')",
            name="ck_quotation_revision_status",
        ),
        sa.CheckConstraint(
            "(sent_at IS NULL AND valid_until IS NULL) OR "
            "(sent_at IS NOT NULL AND valid_until > sent_at AND "
            "valid_until <= sent_at + INTERVAL '90 days')",
            name="ck_quotation_revision_validity",
        ),
    )
    op.create_index(
        "ix_quotation_revisions_quotation_created",
        "quotation_revisions",
        ["quotation_id", "created_at"],
    )
    op.create_table(
        "quotation_line_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "revision_id",
            UUID(as_uuid=True),
            sa.ForeignKey("quotation_revisions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(18, 2)),
        sa.UniqueConstraint("revision_id", "position", name="uq_quotation_line_position"),
        sa.CheckConstraint("position > 0", name="ck_quotation_line_position"),
        sa.CheckConstraint("quantity > 0", name="ck_quotation_line_quantity"),
        sa.CheckConstraint("unit_price >= 0", name="ck_quotation_line_unit_price"),
        sa.CheckConstraint("line_total >= 0", name="ck_quotation_line_total"),
    )
    op.create_index("ix_quotation_line_items_revision", "quotation_line_items", ["revision_id"])


def downgrade() -> None:
    op.drop_index("ix_quotation_line_items_revision", table_name="quotation_line_items")
    op.drop_table("quotation_line_items")
    op.drop_index("ix_quotation_revisions_quotation_created", table_name="quotation_revisions")
    op.drop_table("quotation_revisions")
    op.drop_table("quotations")
