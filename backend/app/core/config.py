"""Validated environment configuration for application startup."""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Load only the configuration needed by currently implemented features."""

    model_config = SettingsConfigDict(
        env_prefix="SOLAR_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="forbid",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"]
    app_name: str = Field(default="Solar Lanka API", min_length=1)
    database_url: SecretStr | None = None
    test_database_url: SecretStr | None = None

    clerk_issuer: str | None = None
    clerk_authorized_parties: list[str] = Field(default_factory=list)
    clerk_audience: str | None = None
    clerk_jwt_key: SecretStr | None = None
    clerk_secret_key: SecretStr | None = None

    clerk_webhook_signing_secret: SecretStr | None = None
    clerk_instance_id: str | None = None

    # Server-only ImageKit variables also live in the shared backend dotenv file.
    imagekit_private_key: SecretStr | None = None
    imagekit_public_key: str | None = None
    imagekit_url_endpoint: str | None = None
