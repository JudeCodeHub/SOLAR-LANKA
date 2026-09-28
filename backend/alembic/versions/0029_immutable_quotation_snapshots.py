"""Freeze sent quotation terms and their product identity snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0029_immutable_quotation_snapshots"
down_revision = "0028_quotation_offer_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quotation_line_items", sa.Column("product_snapshot", JSONB()))
    op.execute("""
        CREATE FUNCTION prevent_sent_revision_mutation() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                IF OLD.status <> 'draft' THEN
                    RAISE EXCEPTION 'Sent quotation revisions are immutable'
                        USING ERRCODE = '23514';
                END IF;
                RETURN OLD;
            END IF;
            IF OLD.status <> 'draft'
               AND (to_jsonb(OLD) - 'status') IS DISTINCT FROM
                   (to_jsonb(NEW) - 'status') THEN
                RAISE EXCEPTION 'Sent quotation terms are immutable'
                    USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_quotation_revision_immutable
        BEFORE UPDATE OR DELETE ON quotation_revisions
        FOR EACH ROW EXECUTE FUNCTION prevent_sent_revision_mutation();
    """)
    op.execute("""
        CREATE FUNCTION prevent_sent_line_mutation() RETURNS trigger AS $$
        DECLARE parent_status text;
        BEGIN
            IF TG_OP <> 'INSERT' THEN
                SELECT status INTO parent_status FROM quotation_revisions
                    WHERE id = OLD.revision_id FOR SHARE;
                IF parent_status <> 'draft' THEN
                    RAISE EXCEPTION 'Sent quotation lines are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;
            IF TG_OP <> 'DELETE' THEN
                SELECT status INTO parent_status FROM quotation_revisions
                    WHERE id = NEW.revision_id FOR SHARE;
                IF parent_status <> 'draft' THEN
                    RAISE EXCEPTION 'Sent quotation lines are immutable'
                        USING ERRCODE = '23514';
                END IF;
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_quotation_line_immutable
        BEFORE INSERT OR UPDATE OR DELETE ON quotation_line_items
        FOR EACH ROW EXECUTE FUNCTION prevent_sent_line_mutation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_quotation_line_immutable ON quotation_line_items")
    op.execute("DROP FUNCTION prevent_sent_line_mutation()")
    op.execute("DROP TRIGGER trg_quotation_revision_immutable ON quotation_revisions")
    op.execute("DROP FUNCTION prevent_sent_revision_mutation()")
    op.drop_column("quotation_line_items", "product_snapshot")
