"""Explicit Phase 1 role/action policy; unknown actions and roles have no grants."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from types import MappingProxyType


class Role(StrEnum):
    VISITOR = "visitor"
    CUSTOMER = "customer"
    COMPANY_ADMIN = "company_admin"
    SALES = "sales"
    TECHNICIAN = "technician"
    PLATFORM_ADMIN = "platform_admin"


class Scope(StrEnum):
    SELF = "self"  # Current user's own account/notifications.
    OWNER = "owner"  # Customer owns the record (or the new record being created).
    COMPANY = "company"  # Active membership in the record's company is required.
    DELIVERY_COMPANY = "delivery_company"  # Only the company's request delivery and offers.
    ASSIGNED_JOB = "assigned_job"  # Assigned technician AND matching active company membership.
    OWNER_PARENT = "owner_parent"  # Parent access plus customer-visible file visibility.
    COMPANY_PARENT = "company_parent"  # Parent access via active company membership.
    ASSIGNED_PARENT = "assigned_parent"  # Assigned job access plus technician file visibility.
    PLATFORM = "platform"  # Only the named platform-management operation, not all private data.


class Action(StrEnum):
    ACCOUNT_READ = "account.read"
    ACCOUNT_UPDATE = "account.update"
    COMPANY_CREATE = "company.create"
    COMPANY_READ_PRIVATE = "company.read_private"
    COMPANY_UPDATE = "company.update"
    COMPANY_SUBMIT = "company.submit"
    COMPANY_REVIEW = "company.review"
    MEMBERSHIP_MANAGE = "membership.manage"
    PRODUCT_MANAGE = "product.manage"
    PRODUCT_OFFER_MANAGE = "product_offer.manage"
    PRODUCT_DOCUMENT_MANAGE = "product_document.manage"
    FAVOURITE_MANAGE = "favourite.manage"
    ESTIMATE_SAVE = "estimate.save"
    ESTIMATE_READ = "estimate.read"
    CALCULATION_CONFIG_MANAGE = "calculation_config.manage"
    CALCULATION_CONFIG_PUBLISH = "calculation_config.publish"
    REQUEST_CREATE = "request.create"
    REQUEST_READ = "request.read"
    REQUEST_WITHDRAW = "request.withdraw"
    DELIVERY_READ = "delivery.read"
    DELIVERY_UPDATE = "delivery.update"
    COMPANY_NOTE_READ = "company_note.read"
    COMPANY_NOTE_WRITE = "company_note.write"
    QUOTATION_READ = "quotation.read"
    QUOTATION_DRAFT = "quotation.draft"
    QUOTATION_SEND = "quotation.send"
    QUOTATION_REVISE = "quotation.revise"
    QUOTATION_WITHDRAW = "quotation.withdraw"
    QUOTATION_COMPARE = "quotation.compare"
    QUOTATION_ACCEPT = "quotation.accept"
    QUOTATION_DECLINE = "quotation.decline"
    INSTALLATION_READ = "installation.read"
    INSTALLATION_UPDATE = "installation.update"
    INSTALLATION_ASSIGN = "installation.assign"
    INSTALLATION_INTERNAL_NOTE = "installation.internal_note"
    ATTACHMENT_UPLOAD = "attachment.upload"
    ATTACHMENT_DOWNLOAD = "attachment.download"
    NOTIFICATION_READ = "notification.read"
    NOTIFICATION_MARK_READ = "notification.mark_read"
    USER_STATUS_MANAGE = "user_status.manage"
    PLATFORM_ACTIVITY_READ = "platform_activity.read"
    AUDIT_READ = "audit.read"


@dataclass(frozen=True)
class Grant:
    role: Role
    scope: Scope


SELF_ACCESS = tuple(Grant(role, Scope.SELF) for role in Role if role != Role.VISITOR)
CUSTOMER_OWNER = (Grant(Role.CUSTOMER, Scope.OWNER),)
COMPANY_STAFF = (
    Grant(Role.COMPANY_ADMIN, Scope.COMPANY),
    Grant(Role.SALES, Scope.COMPANY),
)
DELIVERY_STAFF = (
    Grant(Role.COMPANY_ADMIN, Scope.DELIVERY_COMPANY),
    Grant(Role.SALES, Scope.DELIVERY_COMPANY),
)
PLATFORM_ADMIN = (Grant(Role.PLATFORM_ADMIN, Scope.PLATFORM),)
FILE_ACCESS = (
    Grant(Role.CUSTOMER, Scope.OWNER_PARENT),
    Grant(Role.COMPANY_ADMIN, Scope.COMPANY_PARENT),
    Grant(Role.SALES, Scope.COMPANY_PARENT),
    Grant(Role.TECHNICIAN, Scope.ASSIGNED_PARENT),
)

# Company creation is controlled onboarding; it never grants public users staff roles.
PERMISSION_MATRIX: Mapping[Action, tuple[Grant, ...]] = MappingProxyType(
    {
        Action.ACCOUNT_READ: SELF_ACCESS,
        Action.ACCOUNT_UPDATE: SELF_ACCESS,
        Action.COMPANY_CREATE: PLATFORM_ADMIN,
        Action.COMPANY_READ_PRIVATE: COMPANY_STAFF + PLATFORM_ADMIN,
        Action.COMPANY_UPDATE: COMPANY_STAFF,
        Action.COMPANY_SUBMIT: COMPANY_STAFF,
        Action.COMPANY_REVIEW: PLATFORM_ADMIN,
        Action.MEMBERSHIP_MANAGE: (Grant(Role.COMPANY_ADMIN, Scope.COMPANY),),
        Action.PRODUCT_MANAGE: PLATFORM_ADMIN,
        Action.PRODUCT_OFFER_MANAGE: COMPANY_STAFF,
        Action.PRODUCT_DOCUMENT_MANAGE: PLATFORM_ADMIN,
        Action.FAVOURITE_MANAGE: CUSTOMER_OWNER,
        Action.ESTIMATE_SAVE: CUSTOMER_OWNER,
        Action.ESTIMATE_READ: CUSTOMER_OWNER,
        Action.CALCULATION_CONFIG_MANAGE: PLATFORM_ADMIN,
        Action.CALCULATION_CONFIG_PUBLISH: PLATFORM_ADMIN,
        Action.REQUEST_CREATE: CUSTOMER_OWNER,
        Action.REQUEST_READ: CUSTOMER_OWNER,
        Action.REQUEST_WITHDRAW: CUSTOMER_OWNER,
        Action.DELIVERY_READ: DELIVERY_STAFF,
        Action.DELIVERY_UPDATE: DELIVERY_STAFF,
        Action.COMPANY_NOTE_READ: DELIVERY_STAFF,
        Action.COMPANY_NOTE_WRITE: DELIVERY_STAFF,
        Action.QUOTATION_READ: CUSTOMER_OWNER + DELIVERY_STAFF,
        Action.QUOTATION_DRAFT: DELIVERY_STAFF,
        Action.QUOTATION_SEND: DELIVERY_STAFF,
        Action.QUOTATION_REVISE: DELIVERY_STAFF,
        Action.QUOTATION_WITHDRAW: DELIVERY_STAFF,
        Action.QUOTATION_COMPARE: CUSTOMER_OWNER,
        Action.QUOTATION_ACCEPT: CUSTOMER_OWNER,
        Action.QUOTATION_DECLINE: CUSTOMER_OWNER,
        Action.INSTALLATION_READ: CUSTOMER_OWNER
        + COMPANY_STAFF
        + (Grant(Role.TECHNICIAN, Scope.ASSIGNED_JOB),),
        Action.INSTALLATION_UPDATE: COMPANY_STAFF + (Grant(Role.TECHNICIAN, Scope.ASSIGNED_JOB),),
        Action.INSTALLATION_ASSIGN: COMPANY_STAFF,
        Action.INSTALLATION_INTERNAL_NOTE: COMPANY_STAFF
        + (Grant(Role.TECHNICIAN, Scope.ASSIGNED_JOB),),
        Action.ATTACHMENT_UPLOAD: FILE_ACCESS,
        Action.ATTACHMENT_DOWNLOAD: FILE_ACCESS,
        Action.NOTIFICATION_READ: SELF_ACCESS,
        Action.NOTIFICATION_MARK_READ: SELF_ACCESS,
        Action.USER_STATUS_MANAGE: PLATFORM_ADMIN,
        Action.PLATFORM_ACTIVITY_READ: PLATFORM_ADMIN,
        Action.AUDIT_READ: PLATFORM_ADMIN,
    }
)


def required_scopes(action: Action | str, role: Role | str) -> frozenset[Scope]:
    """Return scopes that still need verification, not permission to access a record."""
    return frozenset(
        grant.scope for grant in PERMISSION_MATRIX.get(action, ()) if grant.role == role
    )
