"""Deny unknown media and enforce public/private boundaries and upload limits."""

import pytest

from app.core.media_policy import (
    MIB,
    POLICIES,
    AssetCategory,
    ParentKind,
    Visibility,
    policy_for,
    validate_upload_metadata,
)
from app.core.permissions import Role


def test_categories_have_explicit_owner_visibility_and_limits():
    assert set(POLICIES) == set(AssetCategory)
    for category, policy in POLICIES.items():
        assert isinstance(policy.parent_kind, ParentKind)
        assert policy.grants and policy.max_bytes > 0 and policy.mime_types
        assert policy.visibility in Visibility
        if category in {
            AssetCategory.COMPANY_CREDENTIAL_DOCUMENT,
            AssetCategory.QUOTATION_DOCUMENT,
            AssetCategory.INSTALLATION_EVIDENCE,
            AssetCategory.SUPPORT_EVIDENCE,
        }:
            assert policy.visibility == Visibility.PRIVATE
        else:
            assert policy.visibility == Visibility.PUBLIC
    assert {grant.role for grant in policy_for(AssetCategory.PRODUCT_IMAGE).grants} == {
        Role.PLATFORM_ADMIN
    }
    assert {grant.role for grant in policy_for(AssetCategory.COMPANY_LOGO).grants} == {
        Role.COMPANY_ADMIN
    }


@pytest.mark.parametrize(
    "category,mime,size",
    [
        (AssetCategory.PRODUCT_IMAGE, "image/jpeg", 8 * MIB),
        (AssetCategory.COMPANY_LOGO, "image/png", 4 * MIB),
        (AssetCategory.QUOTATION_DOCUMENT, "application/pdf", 15 * MIB),
    ],
)
def test_supported_metadata_at_limit(category, mime, size):
    assert validate_upload_metadata(category, size_bytes=size, mime_type=mime) == policy_for(
        category
    )


@pytest.mark.parametrize(
    "category,mime,size",
    [
        ("unknown", "image/png", 1),
        (AssetCategory.COMPANY_LOGO, "image/svg+xml", 1),
        (AssetCategory.QUOTATION_DOCUMENT, "image/jpeg", 1),
        (AssetCategory.PRODUCT_IMAGE, "application/pdf", 1),
        (AssetCategory.PRODUCT_IMAGE, "image/png", 8 * MIB + 1),
        (AssetCategory.PRODUCT_IMAGE, "image/png", 0),
        (AssetCategory.PRODUCT_IMAGE, "image/png", True),
    ],
)
def test_unsupported_metadata_fails_closed(category, mime, size):
    with pytest.raises(ValueError):
        validate_upload_metadata(category, size_bytes=size, mime_type=mime)
