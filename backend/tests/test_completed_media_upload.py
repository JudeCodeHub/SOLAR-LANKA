"""Only provider-verified uploads from the signed target folder can be attached."""

from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.routes import media_uploads
from app.api.schemas.media_uploads import CompletedUpload
from app.core.imagekit import (
    ImageKitFileDetails,
    ImageKitServerAdapter,
    ImageKitSettings,
    issue_upload_auth,
    sign_upload_intent,
)
from app.models.product import Product
from app.models.user import AppUser


def prepared_upload(monkeypatch: pytest.MonkeyPatch):
    settings = ImageKitSettings(
        _env_file=None,
        private_key="private_test_value",
        public_key="public_test_value",
        url_endpoint="https://ik.imagekit.io/test",
    )
    monkeypatch.setattr(media_uploads, "ImageKitSettings", lambda: settings)
    user = AppUser(
        id=uuid4(),
        clerk_subject="verified",
        role="platform_admin",
        is_suspended=False,
        provider_state="active",
    )
    product = Product(id=uuid4(), kind="panel", brand="Test", model="T1", is_archived=False)
    auth = issue_upload_auth(settings)
    body = CompletedUpload(
        category="product_image",
        parent_id=product.id,
        file_id="file_123",
        token=auth["token"],
        expire=auth["expire"],
        attachment_proof=sign_upload_intent(
            settings,
            token=auth["token"],
            expire=auth["expire"],
            owner_id=user.id,
            category="product_image",
            parent_id=product.id,
        ),
    )
    session = MagicMock(spec=Session)
    session.get.return_value = product
    session.scalar.return_value = None
    session.add.side_effect = lambda asset: setattr(asset, "id", uuid4())
    details = ImageKitFileDetails.model_validate(
        {
            "fileId": body.file_id,
            "filePath": f"/pending/{body.token}/photo.jpg",
            "mime": "image/jpeg",
            "size": 1024,
            "fileType": "image",
            "isPrivateFile": False,
            "isPublished": True,
        }
    )
    adapter = MagicMock()
    adapter.get_file_details.return_value = details
    monkeypatch.setattr(media_uploads, "ImageKitServerAdapter", lambda _: adapter)
    return settings, user, body, session, adapter


def test_verified_file_is_attached_without_trusting_client_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, user, body, session, adapter = prepared_upload(monkeypatch)
    result = media_uploads.attach_completed_upload(body, user, session)
    assert result.category == "product_image"
    asset = session.add.call_args.args[0]
    assert asset.provider_file_id == "file_123"
    assert asset.owner_user_id == user.id
    assert asset.parent_id == body.parent_id
    assert asset.visibility == "public"
    adapter.get_file_details.assert_called_once_with("file_123")
    session.commit.assert_called_once()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("file_path", "/unrelated/photo.jpg"),
        ("mime", "application/x-msdownload"),
        ("size", 9 * 1024 * 1024),
        ("is_private_file", True),
        ("is_published", False),
    ],
)
def test_provider_mismatch_is_rejected(monkeypatch: pytest.MonkeyPatch, field: str, value) -> None:
    _, user, body, session, adapter = prepared_upload(monkeypatch)
    adapter.get_file_details.return_value = adapter.get_file_details.return_value.model_copy(
        update={field: value}
    )
    with pytest.raises(HTTPException) as caught:
        media_uploads.attach_completed_upload(body, user, session)
    assert caught.value.status_code == 422
    session.add.assert_not_called()


def test_intent_cannot_be_reused_for_another_user_or_parent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, user, body, session, adapter = prepared_upload(monkeypatch)
    body.parent_id = uuid4()
    with pytest.raises(HTTPException) as caught:
        media_uploads.attach_completed_upload(body, user, session)
    assert caught.value.status_code == 403
    adapter.get_file_details.assert_not_called()


def test_adapter_rejects_url_instead_of_file_id() -> None:
    settings = ImageKitSettings(
        _env_file=None,
        private_key="private_test_value",
        public_key="public_test_value",
        url_endpoint="https://ik.imagekit.io/test",
    )
    adapter = ImageKitServerAdapter(settings)
    try:
        with pytest.raises(ValueError):
            adapter.get_file_details("https://evil.example/image.jpg")
    finally:
        adapter.close()


def test_adapter_fetches_file_details_from_imagekit_api(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = ImageKitSettings(
        _env_file=None,
        private_key="private_test_value",
        public_key="public_test_value",
        url_endpoint="https://ik.imagekit.io/test",
    )
    adapter = ImageKitServerAdapter(settings)

    def respond(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://api.imagekit.io/v1/files/file_123/details"
        assert request.headers["authorization"].startswith("Basic ")
        return httpx.Response(
            200,
            json={
                "fileId": "file_123",
                "filePath": "/pending/test/photo.jpg",
                "mime": "image/jpeg",
                "size": 100,
                "fileType": "image",
                "isPrivateFile": False,
                "isPublished": True,
            },
        )

    adapter._client.close()
    adapter._client = httpx.Client(
        base_url="https://api.imagekit.io",
        auth=httpx.BasicAuth(settings.private_key.get_secret_value(), ""),
        transport=httpx.MockTransport(respond),
    )
    try:
        assert adapter.get_file_details("file_123").file_id == "file_123"
    finally:
        adapter.close()


def test_client_url_cannot_be_submitted_as_provider_file_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, _, body, _, _ = prepared_upload(monkeypatch)
    with pytest.raises(ValidationError):
        CompletedUpload.model_validate(
            {**body.model_dump(), "file_id": "https://evil.example/anything.jpg"}
        )
