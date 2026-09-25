"""Exercise migration lifecycle on an empty database owned solely by this test."""

from io import StringIO
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.config import BACKEND_DIR
from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.user import AppUser


def migration_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


def test_offline_upgrade_generates_sql_without_a_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SOLAR_ENVIRONMENT", "development")
    monkeypatch.setenv(
        "SOLAR_DATABASE_URL", "postgresql://offline:private-password@127.0.0.1:1/offline"
    )
    output = StringIO()
    config = migration_config()
    config.output_buffer = output
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE alembic_version" in sql
    assert "0001_initial_baseline" in sql
    assert "private-password" not in sql


@pytest.mark.database
def test_initial_migration_on_empty_database(database_settings: DatabaseSettings) -> None:
    # Start from the guarded test server, never from development configuration.
    admin_engine = create_database_engine(database_settings)
    temporary_name = f"solarlanka_migration_{uuid4().hex}"
    temporary_engine = None
    created = False
    try:
        with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as admin:
            assert admin.scalar(text("SELECT current_database()")) == "solarlanka_test"
            admin.execute(text(f'CREATE DATABASE "{temporary_name}" TEMPLATE template0'))
            created = True

        temporary_engine = create_engine(
            admin_engine.url.set(database=temporary_name),
            poolclass=NullPool,
            connect_args={"connect_timeout": 5},
        )
        config = migration_config()
        with temporary_engine.begin() as connection:
            assert inspect(connection).get_table_names() == []
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            assert MigrationContext.configure(connection).get_current_revision() == (
                "0002_app_users"
            )

        with Session(temporary_engine) as session:
            user = AppUser(clerk_subject="user_verified_test_subject")
            session.add(user)
            session.commit()
            user_id = user.id
            session.expunge_all()
            persisted = session.get(AppUser, user_id)
            assert persisted is not None
            assert persisted.clerk_subject == "user_verified_test_subject"
            assert persisted.created_at.utcoffset() is not None
            with pytest.raises(IntegrityError) as duplicate:
                with session.begin_nested():
                    session.add(AppUser(clerk_subject=persisted.clerk_subject))
                    session.flush()
            assert duplicate.value.orig.diag.constraint_name == "uq_app_users_clerk_subject"
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(AppUser(clerk_subject=None))
                    session.flush()

        # Verify the revision was persisted, repeated upgrades are safe, and rollback works.
        with temporary_engine.begin() as connection:
            config.attributes["connection"] = connection
            assert inspect(connection).get_table_names() == ["alembic_version", "app_users"]
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            assert MigrationContext.configure(connection).get_current_revision() is None
            command.upgrade(config, "head")
            assert MigrationContext.configure(connection).get_current_revision() == (
                "0002_app_users"
            )
    finally:
        if temporary_engine is not None:
            temporary_engine.dispose()
        try:
            if created:
                with admin_engine.connect().execution_options(
                    isolation_level="AUTOCOMMIT"
                ) as admin:
                    admin.execute(text(f'DROP DATABASE "{temporary_name}"'))
        finally:
            admin_engine.dispose()
