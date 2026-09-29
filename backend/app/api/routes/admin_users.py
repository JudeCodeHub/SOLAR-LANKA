"""Platform administrator changes to local application account access."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.admin_users import AccountStatusUpdate, AccountStatusView
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.user import AppUser
from app.services.audit import AuditAction, record_audit

router = APIRouter(prefix="/admin/users", tags=["administration"])


def require_account_administrator(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.USER_STATUS_MANAGE, user.role):
        raise HTTPException(403)
    return user


@router.patch("/{user_id}/status", response_model=AccountStatusView)
def update_account_status(
    user_id: UUID,
    body: AccountStatusUpdate,
    actor: Annotated[AppUser, Depends(require_account_administrator)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AccountStatusView:
    response.headers["Cache-Control"] = "no-store"
    target = session.scalars(
        select(AppUser).where(AppUser.id == user_id).with_for_update()
    ).one_or_none()
    if target is None:
        raise HTTPException(404)
    if target.id == actor.id and body.is_suspended:
        raise HTTPException(409, "Administrators cannot suspend their own account.")
    if not body.is_suspended and target.provider_state != "active":
        raise HTTPException(409, "Provider-revoked accounts cannot be restored locally.")
    if target.is_suspended != body.is_suspended:
        target.is_suspended = body.is_suspended
        record_audit(
            session,
            actor_id=actor.id,
            company_id=None,
            target_id=target.id,
            action=(AuditAction.USER_SUSPENDED if body.is_suspended else AuditAction.USER_RESTORED),
        )
        session.commit()
    return AccountStatusView(
        id=target.id, is_suspended=target.is_suspended, provider_state=target.provider_state
    )
