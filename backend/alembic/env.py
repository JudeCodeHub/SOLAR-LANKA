"""Alembic uses the same validated targets as application database connections."""

from alembic import context
from sqlalchemy import Connection
from sqlalchemy.engine import make_url

from app.core.database_config import DatabaseSettings, load_test_database_settings
from app.db.base import Base
from app.db.session import create_database_engine
from app.models.lifecycle_event import LifecycleEvent  # noqa: F401
from app.models.user import AppUser  # noqa: F401 -- register model metadata

config = context.config
target_metadata = Base.metadata


def load_settings() -> DatabaseSettings:
    target = context.get_x_argument(as_dictionary=True).get("environment")
    if target is None:
        return DatabaseSettings()
    if target == "test":
        return load_test_database_settings()
    raise ValueError("Only '-x environment=test' is supported; omit it for application settings")


def run_with_connection(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations() -> None:
    if context.is_offline_mode():
        settings = load_settings()
        url = make_url(settings.connection_url.get_secret_value()).set(
            drivername="postgresql+psycopg"
        )
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    # Tests may supply an already-authorised connection to their temporary database.
    connection = config.attributes.get("connection")
    if connection is not None:
        run_with_connection(connection)
        return

    engine = create_database_engine(load_settings())
    try:
        with engine.connect() as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


run_migrations()
