from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core import database_config
from app.core.database_config import DatabaseSettings, load_test_database_settings

DEV_URL = "postgresql://solarlanka_dev:dummy_dev@127.0.0.1:5432/solarlanka_dev"
TEST_URL = "postgresql://solarlanka_test:dummy_test@127.0.0.1:5433/solarlanka_test"


@pytest.fixture(autouse=True)
def isolate_database_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("SOLAR_DATABASE_URL", "SOLAR_TEST_DATABASE_URL", "SOLAR_ENVIRONMENT"):
        monkeypatch.delenv(name, raising=False)


def test_test_mode_selects_only_test_url() -> None:
    settings = DatabaseSettings(
        _env_file=None, environment="test", database_url=DEV_URL, test_database_url=TEST_URL
    )
    assert settings.connection_url.get_secret_value() == TEST_URL
    assert "dummy_test" not in repr(settings)


def test_test_mode_cannot_fall_back_to_development_url() -> None:
    with pytest.raises(ValidationError, match="SOLAR_TEST_DATABASE_URL is required"):
        DatabaseSettings(_env_file=None, environment="test", database_url=DEV_URL)


@pytest.mark.parametrize(
    "url",
    [
        DEV_URL,
        TEST_URL.replace("5433", "5432"),
        TEST_URL.replace("/solarlanka_test", "/solarlanka_dev"),
        TEST_URL.replace("solarlanka_test:", "solarlanka_dev:"),
        TEST_URL.replace("127.0.0.1", "postgres"),
        TEST_URL + "?dbname=solarlanka_dev",
        TEST_URL + "?host=postgres&port=5432",
        TEST_URL.replace("/solarlanka_test", "/%73olarlanka_dev"),
        TEST_URL.replace("dummy_test", ""),
        TEST_URL.replace("5433", "invalid"),
    ],
)
def test_unsafe_test_target_is_rejected(url: str) -> None:
    with pytest.raises(ValidationError):
        DatabaseSettings(_env_file=None, environment="test", test_database_url=url)


def test_test_service_address_is_accepted() -> None:
    url = TEST_URL.replace("127.0.0.1:5433", "postgres-test:5432")
    settings = DatabaseSettings(_env_file=None, environment="test", test_database_url=url)
    assert settings.connection_url.get_secret_value() == url


def test_development_mode_selects_development_url() -> None:
    settings = DatabaseSettings(
        _env_file=None, environment="development", database_url=DEV_URL, test_database_url=TEST_URL
    )
    assert settings.connection_url.get_secret_value() == DEV_URL


def test_loader_ignores_development_file_and_forces_test_mode(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env").write_text(f"SOLAR_DATABASE_URL={DEV_URL}\n")
    (tmp_path / ".env.test").write_text(f"SOLAR_TEST_DATABASE_URL={TEST_URL}\n")
    monkeypatch.setattr(database_config, "BACKEND_DIR", tmp_path)
    monkeypatch.setenv("SOLAR_ENVIRONMENT", "development")
    settings = load_test_database_settings()
    assert settings.environment == "test"
    assert settings.database_url is None
    assert settings.connection_url.get_secret_value() == TEST_URL


def test_loader_rejects_unsafe_environment_override(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / ".env.test").write_text(f"SOLAR_TEST_DATABASE_URL={TEST_URL}\n")
    monkeypatch.setattr(database_config, "BACKEND_DIR", tmp_path)
    monkeypatch.setenv("SOLAR_TEST_DATABASE_URL", DEV_URL)
    with pytest.raises(ValidationError):
        load_test_database_settings()
