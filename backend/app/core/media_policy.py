"""Asset ownership, visibility and upload limits for Phase 6.

A listed grant permits a later endpoint to check the named parent record; it is
never permission by itself. Upload and download handlers must verify the actor's
persisted role, parent ownership/assignment, file bytes, and provider file ID.
Private documents must use private storage and authorised delivery, never a
public ImageKit URL. Unknown categories are denied.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType

from app.core.permissions import Grant, Role, Scope

MIB = 1024 * 1024
IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
PDF_TYPES = frozenset({"application/pdf"})


class Visibility(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class AssetCategory(StrEnum):
    PRODUCT_IMAGE = "product_image"
    COMPANY_LOGO = "company_logo"
    INSTALLATION_GALLERY = "installation_gallery"
    PRODUCT_DATASHEET = "product_datasheet"
    QUOTATION_DOCUMENT = "quotation_document"
    INSTALLATION_EVIDENCE = "installation_evidence"
    SUPPORT_EVIDENCE = "support_evidence"


class ParentKind(StrEnum):
    PRODUCT = "product"
    COMPANY = "company"
    QUOTATION_REVISION = "quotation_revision"
    INSTALLATION = "installation"
    SUPPORT_CASE = "support_case"


@dataclass(frozen=True)
class AssetPolicy:
    parent_kind: ParentKind
    visibility: Visibility
    grants: tuple[Grant, ...]
    max_bytes: int
    mime_types: frozenset[str]


POLICIES: Mapping[AssetCategory, AssetPolicy] = MappingProxyType(
    {
        AssetCategory.PRODUCT_IMAGE: AssetPolicy(
            ParentKind.PRODUCT,
            Visibility.PUBLIC,
            (Grant(Role.PLATFORM_ADMIN, Scope.PLATFORM),),
            8 * MIB,
            IMAGE_TYPES,
        ),
        AssetCategory.COMPANY_LOGO: AssetPolicy(
            ParentKind.COMPANY,
            Visibility.PUBLIC,
            (Grant(Role.COMPANY_ADMIN, Scope.COMPANY),),
            4 * MIB,
            IMAGE_TYPES,
        ),
        AssetCategory.INSTALLATION_GALLERY: AssetPolicy(
            ParentKind.INSTALLATION,
            Visibility.PUBLIC,
            (Grant(Role.COMPANY_ADMIN, Scope.COMPANY),),
            8 * MIB,
            IMAGE_TYPES,
        ),
        AssetCategory.PRODUCT_DATASHEET: AssetPolicy(
            ParentKind.PRODUCT,
            Visibility.PUBLIC,
            (Grant(Role.PLATFORM_ADMIN, Scope.PLATFORM),),
            15 * MIB,
            PDF_TYPES,
        ),
        AssetCategory.QUOTATION_DOCUMENT: AssetPolicy(
            ParentKind.QUOTATION_REVISION,
            Visibility.PRIVATE,
            (
                Grant(Role.COMPANY_ADMIN, Scope.COMPANY_PARENT),
                Grant(Role.SALES, Scope.COMPANY_PARENT),
            ),
            15 * MIB,
            PDF_TYPES,
        ),
        AssetCategory.INSTALLATION_EVIDENCE: AssetPolicy(
            ParentKind.INSTALLATION,
            Visibility.PRIVATE,
            (
                Grant(Role.COMPANY_ADMIN, Scope.COMPANY_PARENT),
                Grant(Role.SALES, Scope.COMPANY_PARENT),
                Grant(Role.TECHNICIAN, Scope.ASSIGNED_PARENT),
            ),
            8 * MIB,
            IMAGE_TYPES,
        ),
        AssetCategory.SUPPORT_EVIDENCE: AssetPolicy(
            ParentKind.SUPPORT_CASE,
            Visibility.PRIVATE,
            (
                Grant(Role.CUSTOMER, Scope.OWNER_PARENT),
                Grant(Role.TECHNICIAN, Scope.ASSIGNED_PARENT),
            ),
            8 * MIB,
            IMAGE_TYPES,
        ),
    }
)


def policy_for(category: AssetCategory | str) -> AssetPolicy:
    """Reject unknown categories rather than assigning a default public policy."""
    try:
        return POLICIES[AssetCategory(category)]
    except ValueError, KeyError:
        raise ValueError("Unsupported asset category") from None


def validate_upload_metadata(
    category: AssetCategory | str, *, size_bytes: int, mime_type: str
) -> AssetPolicy:
    """Check declared metadata; completed-upload checks must also inspect actual bytes."""
    policy = policy_for(category)
    if type(size_bytes) is not int or not 0 < size_bytes <= policy.max_bytes:
        raise ValueError("File size is outside the permitted range")
    if mime_type not in policy.mime_types:
        raise ValueError("Unsupported file type")
    return policy
