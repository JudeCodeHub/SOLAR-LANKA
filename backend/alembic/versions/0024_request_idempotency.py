"""Reserve one submission key per customer and retain the original response."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0024_request_idempotency"
down_revision = "0023_quotation_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotation_requests", sa.Column("idempotency_key", UUID(as_uuid=True)))
    op.add_column("quotation_requests", sa.Column("submission_fingerprint", sa.String(64)))
    op.add_column("quotation_requests", sa.Column("submission_response", JSONB()))
    op.create_unique_constraint(
        "uq_quotation_request_customer_key",
        "quotation_requests",
        ["customer_id", "idempotency_key"],
    )
    op.create_check_constraint(
        "ck_quotation_request_idempotency",
        "quotation_requests",
        "(idempotency_key IS NULL AND submission_fingerprint IS NULL "
        "AND submission_response IS NULL) OR "
        "(idempotency_key IS NOT NULL AND submission_fingerprint ~ '^[0-9a-f]{64}$' "
        "AND jsonb_typeof(submission_response) = 'object')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_quotation_request_idempotency", "quotation_requests", type_="check")
    op.drop_constraint(
        "uq_quotation_request_customer_key", "quotation_requests", type_="unique"
    )
    op.drop_column("quotation_requests", "submission_response")
    op.drop_column("quotation_requests", "submission_fingerprint")
    op.drop_column("quotation_requests", "idempotency_key")
