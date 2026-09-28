"""Prevent modification or removal of published estimator versions."""

from alembic import op

revision = "0021_estimator_config_immutable"
down_revision = "0020_estimator_config_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION prevent_published_estimator_config_change()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.status = 'published' THEN
                RAISE EXCEPTION 'Published estimator configurations are immutable';
            END IF;
            RETURN OLD;
        END;
        $$;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_estimator_config_immutable
        BEFORE UPDATE OR DELETE ON estimator_config_versions
        FOR EACH ROW EXECUTE FUNCTION prevent_published_estimator_config_change();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_estimator_config_immutable ON estimator_config_versions")
    op.execute("DROP FUNCTION prevent_published_estimator_config_change()")
