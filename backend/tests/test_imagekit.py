"""ImageKit credentials stay in server configuration and HTTP auth."""

import hashlib
import hmac
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.core import imagekit
from app.core.imagekit import ImageKitServerAdapter, ImageKitSettings, issue_upload_auth


def settings(**overrides: str) -> ImageKitSettings:
    return ImageKitSettings(
        _env_file=None,
        private_key="private_test_value",
        public_key="public_test_value",
        url_endpoint="https://ik.imagekit.io/test-account",
        **overrides,
    )


def test_adapter_uses_server_secret_without_public_serialization() -> None:
    config = settings()
    adapter = ImageKitServerAdapter(config)
    try:
        assert adapter.url_endpoint == "https://ik.imagekit.io/test-account"
        assert "private_test_value" not in repr(config)
        assert "private_test_value" not in config.model_dump_json()
        assert "private_test_value" not in repr(adapter)
        request = adapter._client.build_request("GET", "/v1/files")
        assert request.url == "https://api.imagekit.io/v1/files"
        signed_request = next(adapter._client.auth.sync_auth_flow(request))
        assert signed_request.headers["authorization"].startswith("Basic ")
        assert "private_test_value" not in repr(signed_request)
    finally:
        adapter.close()


@pytest.mark.parametrize(
    ("private_key", "url_endpoint"),
    [
        ("public_wrong_key", "https://ik.imagekit.io/test-account"),
        ("private_test_value", "http://ik.imagekit.io/test-account"),
    ],
)
def test_invalid_server_settings_fail_closed(private_key: str, url_endpoint: str) -> None:
    with pytest.raises(ValidationError):
        ImageKitSettings(_env_file=None, private_key=private_key, url_endpoint=url_endpoint)


def test_upload_auth_matches_imagekit_v1_signature(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(imagekit.time, "time", lambda: 1_700_000_000)
    auth = issue_upload_auth(settings())
    assert UUID(auth["token"]).version == 4
    assert auth["expire"] == 1_700_000_300
    expected = hmac.new(
        b"private_test_value", f"{auth['token']}{auth['expire']}".encode(), hashlib.sha1
    ).hexdigest()
    assert auth["signature"] == expected
    assert auth["publicKey"] == "public_test_value"
    assert "private_test_value" not in str(auth)
