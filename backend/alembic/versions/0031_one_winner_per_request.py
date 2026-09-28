"""Enforce one accepted quotation revision per customer request."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0031_one_winner_per_request"
down_revision = "0030_installations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotation_revisions", sa.Column("request_id", UUID(as_uuid=True)))
    op.execute("""
        UPDATE quotation_revisions AS revision
        SET request_id = delivery.request_id
        FROM quotations AS quotation
        JOIN request_deliveries AS delivery ON delivery.id = quotation.delivery_id
        WHERE revision.quotation_id = quotation.id
    """)
    op.alter_column("quotation_revisions", "request_id", nullable=False)
    op.create_foreign_key(
        "fk_quotation_revisions_request",
        "quotation_revisions",
        "quotation_requests",
        ["request_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "uq_quotation_revisions_one_accepted_request",
        "quotation_revisions",
        ["request_id"],
        unique=True,
        postgresql_where=sa.text("status = 'accepted'"),
    )
    op.execute("""
        CREATE FUNCTION enforce_revision_request() RETURNS trigger AS $$
        DECLARE actual_request_id uuid;
        BEGIN
            SELECT delivery.request_id INTO actual_request_id
            FROM quotations AS quotation
            JOIN request_deliveries AS delivery ON delivery.id = quotation.delivery_id
            WHERE quotation.id = NEW.quotation_id;
            IF actual_request_id IS NULL OR NEW.request_id IS DISTINCT FROM actual_request_id THEN
                RAISE EXCEPTION 'Quotation revision request does not match its delivery'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_revision_request_matches
        BEFORE INSERT OR UPDATE ON quotation_revisions
        FOR EACH ROW EXECUTE FUNCTION enforce_revision_request();
    """)
    op.execute("""
        CREATE FUNCTION prevent_quotation_reparent() RETURNS trigger AS $$
        BEGIN
            IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id THEN
                RAISE EXCEPTION 'Quotation delivery cannot change'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_quotation_delivery_fixed
        BEFORE UPDATE ON quotations
        FOR EACH ROW EXECUTE FUNCTION prevent_quotation_reparent();
    """)
    op.execute("""
        CREATE FUNCTION prevent_delivery_reparent() RETURNS trigger AS $$
        BEGIN
            IF NEW.request_id IS DISTINCT FROM OLD.request_id THEN
                RAISE EXCEPTION 'Recipient delivery request cannot change'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_request_delivery_request_fixed
        BEFORE UPDATE ON request_deliveries
        FOR EACH ROW EXECUTE FUNCTION prevent_delivery_reparent();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_request_delivery_request_fixed ON request_deliveries")
    op.execute("DROP FUNCTION prevent_delivery_reparent()")
    op.execute("DROP TRIGGER trg_quotation_delivery_fixed ON quotations")
    op.execute("DROP FUNCTION prevent_quotation_reparent()")
    op.execute("DROP TRIGGER trg_revision_request_matches ON quotation_revisions")
    op.execute("DROP FUNCTION enforce_revision_request()")
    op.drop_index("uq_quotation_revisions_one_accepted_request", table_name="quotation_revisions")
    op.drop_constraint("fk_quotation_revisions_request", "quotation_revisions", type_="foreignkey")
    op.drop_column("quotation_revisions", "request_id")
