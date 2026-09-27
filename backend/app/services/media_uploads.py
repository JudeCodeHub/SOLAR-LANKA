"""Authorize upload requests against persisted actors and target records."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.media_policy import AssetCategory, AssetPolicy, ParentKind, policy_for
from app.core.permissions import Grant, Role, Scope
from app.models.company import Company, CompanyMembership
from app.models.product import Product
from app.models.user import AppUser


def authorize_upload(
    session: Session, user: AppUser, category: AssetCategory, parent_id: UUID
) -> AssetPolicy:
    """Return policy only after checking the persisted target and actor's scope."""
    if user.is_suspended or user.provider_state != "active":
        raise HTTPException(403)

    policy = policy_for(category)
    if policy.parent_kind == ParentKind.PRODUCT:
        product = session.get(Product, parent_id)
        if product is None or product.is_archived:
            raise HTTPException(404)
        if (
            user.role != Role.PLATFORM_ADMIN
            or Grant(Role.PLATFORM_ADMIN, Scope.PLATFORM) not in policy.grants
        ):
            raise HTTPException(403)
    elif policy.parent_kind == ParentKind.COMPANY:
        company = session.get(Company, parent_id)
        if company is None:
            raise HTTPException(404)
        membership = session.scalars(
            select(CompanyMembership).where(
                CompanyMembership.company_id == company.id,
                CompanyMembership.user_id == user.id,
                CompanyMembership.status == "active",
            )
        ).one_or_none()
        if membership is None or not any(
            grant.role == membership.role and grant.scope == Scope.COMPANY
            for grant in policy.grants
        ):
            raise HTTPException(403)
    else:
        # Future parent types need their own persisted ownership/assignment checks.
        raise HTTPException(403)
    return policy
