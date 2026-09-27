"""Upload requests require persisted parent access, not client-selected roles."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.routes import media_uploads
from app.api.routes.media_uploads import request_upload
from app.api.schemas.media_uploads import UploadRequest
from app.core.imagekit import ImageKitSettings
from app.core.media_policy import AssetCategory
from app.models.company import Company, CompanyMembership
from app.models.product import Product
from app.models.user import AppUser
from app.services.media_uploads import authorize_upload


def actor(role: str = "customer") -> AppUser:
    return AppUser(
        id=uuid4(),
        clerk_subject="verified-user",
        role=role,
        is_suspended=False,
        provider_state="active",
    )


def test_platform_admin_can_request_existing_product_upload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = ImageKitSettings(
        _env_file=None,
        private_key="private_test_value",
        public_key="public_test_value",
        url_endpoint="https://ik.imagekit.io/test",
    )
    monkeypatch.setattr(media_uploads, "ImageKitSettings", lambda: config)
    product = Product(id=uuid4(), kind="panel", brand="Test", model="T1")
    session = MagicMock(spec=Session)
    session.get.return_value = product

    result = request_upload(
        UploadRequest(
            category="product_image", parent_id=product.id, size_bytes=100, mime_type="image/jpeg"
        ),
        actor("platform_admin"),
        session,
    )

    assert result.visibility == "public"
    assert result.parent_id == product.id
    assert result.publicKey == "public_test_value"
    assert len(result.signature) == 40
    session.get.assert_called_once_with(Product, product.id)


def test_customer_cannot_request_product_upload() -> None:
    session = MagicMock(spec=Session)
    session.get.return_value = Product(id=uuid4(), kind="panel", brand="Test", model="T1")
    with pytest.raises(HTTPException) as caught:
        authorize_upload(session, actor(), AssetCategory.PRODUCT_IMAGE, uuid4())
    assert caught.value.status_code == 403


def test_company_admin_requires_active_membership_in_target_company() -> None:
    company = Company(id=uuid4(), name="Test installer")
    user = actor()
    session = MagicMock(spec=Session)
    session.get.return_value = company
    session.scalars.return_value.one_or_none.return_value = CompanyMembership(
        user_id=user.id, company_id=company.id, role="company_admin", status="active"
    )

    authorize_upload(session, user, AssetCategory.COMPANY_LOGO, company.id)
    query = session.scalars.call_args.args[0]
    assert {company.id, user.id, "active"} <= set(query.compile().params.values())

    session.scalars.return_value.one_or_none.return_value = None
    with pytest.raises(HTTPException) as caught:
        authorize_upload(session, user, AssetCategory.COMPANY_LOGO, company.id)
    assert caught.value.status_code == 403


@pytest.mark.parametrize(
    "category", ["quotation_document", "installation_evidence", "support_evidence"]
)
def test_unimplemented_parent_categories_fail_closed(category: str) -> None:
    with pytest.raises(HTTPException) as caught:
        authorize_upload(
            MagicMock(spec=Session), actor("platform_admin"), AssetCategory(category), uuid4()
        )
    assert caught.value.status_code == 403


def test_suspended_actor_and_missing_parent_are_denied() -> None:
    user = actor("platform_admin")
    user.is_suspended = True
    with pytest.raises(HTTPException) as caught:
        authorize_upload(MagicMock(spec=Session), user, AssetCategory.PRODUCT_IMAGE, uuid4())
    assert caught.value.status_code == 403

    session = MagicMock(spec=Session)
    session.get.return_value = None
    with pytest.raises(HTTPException) as caught:
        authorize_upload(session, actor("platform_admin"), AssetCategory.PRODUCT_IMAGE, uuid4())
    assert caught.value.status_code == 404
