"""Test fixtures isolated from the developer's environment file."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Connection, Engine, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database_config import DatabaseSettings, load_test_database_settings
from app.db.session import create_database_engine, get_session
from app.main import create_app


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--database", action="store_true", help="Run dedicated PostgreSQL tests")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if not config.getoption("--database"):
        skip_database = pytest.mark.skip(
            reason="Requires --database and the PostgreSQL test service"
        )
        for item in items:
            if "database" in item.keywords:
                item.add_marker(skip_database)


@pytest.fixture
def database_settings() -> DatabaseSettings:
    """The only database configuration fixture for future database-dependent tests."""
    return load_test_database_settings()


@pytest.fixture
def client() -> Iterator[TestClient]:
    settings = Settings(_env_file=None, environment="test", app_name="Solar Lanka Test API")
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def database_engine(
    request: pytest.FixtureRequest, database_settings: DatabaseSettings
) -> Iterator[Engine]:
    """Connect only to the guarded test database, even if a test forgets its marker."""
    if not request.config.getoption("--database"):
        pytest.skip("Database fixtures require --database")
    engine = create_database_engine(database_settings)
    try:
        with engine.connect() as connection:
            identity = connection.execute(text("SELECT current_database(), current_user")).one()
            if tuple(identity) != ("solarlanka_test", "solarlanka_test"):
                pytest.fail("Database fixtures require the dedicated test database and user")
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def database_connection(database_engine: Engine) -> Iterator[Connection]:
    """Own the outer transaction; test sessions must not commit this connection directly."""
    with database_engine.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()


@pytest.fixture
def database_session(database_connection: Connection) -> Iterator[Session]:
    """Session commits release savepoints; fixture teardown rolls back all test writes."""
    with Session(bind=database_connection, join_transaction_mode="create_savepoint") as session:
        yield session


@pytest.fixture
def database_client(
    database_settings: DatabaseSettings, database_connection: Connection
) -> Iterator[TestClient]:
    """Route sessions share the outer test transaction, never a production connection."""
    application = create_app(database_settings)

    def isolated_request_session() -> Iterator[Session]:
        with Session(bind=database_connection, join_transaction_mode="create_savepoint") as session:
            yield session

    application.dependency_overrides[get_session] = isolated_request_session
    try:
        with TestClient(application) as test_client:
            yield test_client
    finally:
        application.dependency_overrides.clear()
