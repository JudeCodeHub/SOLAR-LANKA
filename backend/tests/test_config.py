import pytest
from pydantic import ValidationError

from app import main
from app.core.config import Settings


def test_missing_environment_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SOLAR_ENVIRONMENT", raising=False)

    with pytest.raises(ValidationError) as caught:
        Settings(_env_file=None)

    assert caught.value.errors()[0]["loc"] == ("environment",)
    assert caught.value.errors()[0]["type"] == "missing"


def test_invalid_environment_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="invalid")


def test_environment_variables_override_dotenv(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("SOLAR_ENVIRONMENT=development\n", encoding="utf-8")
    monkeypatch.setenv("SOLAR_ENVIRONMENT", "test")

    assert Settings(_env_file=env_file).environment == "test"


def test_startup_error_is_actionable_without_exposing_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SOLAR_ENVIRONMENT", "sensitive-invalid-value")
    monkeypatch.setattr(main, "Settings", lambda: Settings(_env_file=None))

    with pytest.raises(RuntimeError, match="Invalid configuration: environment") as caught:
        main.create_app()

    assert "sensitive-invalid-value" not in str(caught.value)
    assert ".env.example" in str(caught.value)
