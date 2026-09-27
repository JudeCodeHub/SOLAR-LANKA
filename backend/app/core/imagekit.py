"""Server-only ImageKit API configuration and HTTP adapter."""

import hashlib
import hmac
import re
import time
from uuid import UUID, uuid4

import httpx
from pydantic import BaseModel, Field, HttpUrl, SecretStr, StrictInt, field_validator
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
    public_key: str = Field(pattern=r"^public_.+")
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


class ImageKitFileDetails(BaseModel):
    file_id: str = Field(alias="fileId")
    file_path: str = Field(alias="filePath")
    mime: str
    size: StrictInt
    file_type: str = Field(alias="fileType")
    is_private_file: bool = Field(alias="isPrivateFile")
    is_published: bool = Field(alias="isPublished")


class ImageKitServerAdapter:
    """Authenticated ImageKit REST client; never serialize this object to an API response."""

    def __init__(self, settings: ImageKitSettings) -> None:
        self.url_endpoint = str(settings.url_endpoint).rstrip("/")
        self._client = httpx.Client(
            base_url="https://api.imagekit.io",
            auth=httpx.BasicAuth(settings.private_key.get_secret_value(), ""),
            timeout=10.0,
        )

    def get_file_details(self, file_id: str) -> ImageKitFileDetails:
        """Retrieve authoritative metadata by provider ID, never by a client URL."""
        if re.fullmatch(r"[A-Za-z0-9_-]{1,255}", file_id) is None:
            raise ValueError("Invalid ImageKit file ID")
        response = self._client.get(f"/v1/files/{file_id}/details")
        response.raise_for_status()
        return ImageKitFileDetails.model_validate(response.json())

    def close(self) -> None:
        self._client.close()


def issue_upload_auth(settings: ImageKitSettings) -> dict[str, str | int]:
    """Issue ImageKit Upload V1 parameters for one short-lived browser upload."""
    token = str(uuid4())
    expire = int(time.time()) + 300
    signature = hmac.new(
        settings.private_key.get_secret_value().encode(),
        f"{token}{expire}".encode(),
        hashlib.sha1,
    ).hexdigest()
    return {
        "token": token,
        "expire": expire,
        "signature": signature,
        "publicKey": settings.public_key,
    }


def sign_upload_intent(
    settings: ImageKitSettings,
    *,
    token: str,
    expire: int,
    owner_id: UUID,
    category: str,
    parent_id: UUID,
) -> str:
    """Bind an upload folder to one actor, category, target, and expiry."""
    message = f"attachment:v1:{token}:{expire}:{owner_id}:{category}:{parent_id}"
    return hmac.new(
        settings.private_key.get_secret_value().encode(), message.encode(), hashlib.sha256
    ).hexdigest()


def verify_upload_intent(
    settings: ImageKitSettings,
    *,
    token: UUID,
    expire: int,
    signature: str,
    owner_id: UUID,
    category: str,
    parent_id: UUID,
) -> bool:
    if expire <= int(time.time()) or expire > int(time.time()) + 3600:
        return False
    expected = sign_upload_intent(
        settings,
        token=str(token),
        expire=expire,
        owner_id=owner_id,
        category=category,
        parent_id=parent_id,
    )
    return hmac.compare_digest(expected, signature)
