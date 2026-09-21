"""Test fixtures isolated from the developer's environment file."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.database_config import DatabaseSettings, load_test_database_settings
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
