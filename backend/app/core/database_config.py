"""Validated database target selection shared by application and test sessions."""

from typing import Self
from urllib.parse import unquote, urlsplit

from pydantic import ConfigDict, SecretStr, model_validator

from app.core.config import BACKEND_DIR, Settings


class DatabaseSettings(Settings):
    """Keep test credentials separate and reject unsafe test targets before connecting."""

    model_config = ConfigDict(frozen=True)

    @model_validator(mode="after")
    def validate_target(self) -> Self:
        selected = self.test_database_url if self.environment == "test" else self.database_url
        if selected is None:
            name = "SOLAR_TEST_DATABASE_URL" if self.environment == "test" else "SOLAR_DATABASE_URL"
            raise ValueError(f"{name} is required; no database URL fallback is allowed")

        try:
            target = urlsplit(selected.get_secret_value())
            port = target.port
        except ValueError:
            raise ValueError("Database URL is malformed") from None

        if (
            target.scheme not in {"postgresql", "postgresql+psycopg"}
            or not target.hostname
            or not target.username
            or not target.password
            or not target.path.removeprefix("/")
            or target.fragment
        ):
            raise ValueError(
                "Database URL requires a PostgreSQL scheme, host, credentials, and name"
            )

        if self.environment == "test":
            expected_port = 5432 if target.hostname == "postgres-test" else 5433
            if (
                target.hostname not in {"127.0.0.1", "localhost", "postgres-test"}
                or port != expected_port
                or unquote(target.username) != "solarlanka_test"
                or unquote(target.path) != "/solarlanka_test"
                or target.query
            ):
                raise ValueError(
                    "Tests require the dedicated solarlanka_test user/database at "
                    "localhost:5433 or postgres-test:5432, without URL query overrides"
                )
        return self

    @property
    def connection_url(self) -> SecretStr:
        """Return the already-validated target without exposing it in representations."""
        selected = self.test_database_url if self.environment == "test" else self.database_url
        assert selected is not None  # Enforced at model validation.
        return selected


def load_test_database_settings() -> DatabaseSettings:
    """Always select test mode and its own file, regardless of the developer's app mode."""
    return DatabaseSettings(_env_file=BACKEND_DIR / ".env.test", environment="test")
