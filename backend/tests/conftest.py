"""Test fixtures isolated from the developer's environment file."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    settings = Settings(_env_file=None, environment="test", app_name="Solar Lanka Test API")
    with TestClient(create_app(settings)) as test_client:
        yield test_client
