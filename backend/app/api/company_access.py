"""Company membership gate; action-specific permissions remain separate checks."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.user import AppUser


def require_company_membership(
    company_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
) -> CompanyMembership:
    """Resolve membership from local identity and the requested company together."""
    membership = session.scalars(
        select(CompanyMembership).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.status == "active",
        )
    ).one_or_none()
    if membership is None:
        raise HTTPException(status_code=403)
    return membership


def require_company_permission(action: Action) -> Callable[..., CompanyMembership]:
    """Bind a server-selected action to an active company membership."""

    def authorize(
        membership: Annotated[CompanyMembership, Depends(require_company_membership)],
    ) -> CompanyMembership:
        if Scope.COMPANY not in required_scopes(action, membership.role):
            raise HTTPException(status_code=403)
        return membership

    return authorize
