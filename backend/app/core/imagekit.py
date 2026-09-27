"""Server-only ImageKit API configuration and HTTP adapter."""

import httpx
from pydantic import Field, HttpUrl, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR


class ImageKitSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SOLAR_IMAGEKIT_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    private_key: SecretStr = Field(min_length=1)
    url_endpoint: HttpUrl

    @field_validator("private_key")
    @classmethod
    def validate_private_key(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().startswith("private_"):
            raise ValueError("Expected an ImageKit private API key")
        return value

    @field_validator("url_endpoint")
    @classmethod
    def require_https(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("ImageKit delivery URL must use HTTPS")
        return value


class ImageKitServerAdapter:
    """Authenticated ImageKit REST client; never serialize this object to an API response."""

    def __init__(self, settings: ImageKitSettings) -> None:
        self.url_endpoint = str(settings.url_endpoint).rstrip("/")
        self._client = httpx.Client(
            base_url="https://api.imagekit.io",
            auth=httpx.BasicAuth(settings.private_key.get_secret_value(), ""),
            timeout=10.0,
        )

    def close(self) -> None:
        self._client.close()
