"""Technician invite codes: an administrator makes one and the technician applies it."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.memberships import (
    InviteAccept,
    InviteCreated,
    InviteView,
    MembershipResponse,
    MemberView,
)
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import CompanyInvite, CompanyMembership
from app.models.user import AppUser
from app.services.audit import AuditAction, record_audit

router = APIRouter(prefix="/companies/{company_id}", tags=["invites"])
accept_router = APIRouter(prefix="/invites", tags=["invites"])

# No 0, O, 1, I or L, so a code read aloud or copied by hand is not misread.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 10
LIFETIME = timedelta(days=7)
MAX_OPEN_INVITES = 25


def _normalise(code: str) -> str:
    return "".join(character for character in code.upper() if character.isalnum())


def _hash(code: str) -> str:
    return hashlib.sha256(_normalise(code).encode()).hexdigest()


def _status(invite: CompanyInvite, now: datetime) -> str:
    if invite.used_at is not None:
        return "used"
    if invite.revoked_at is not None:
        return "revoked"
    return "expired" if invite.expires_at <= now else "active"


@router.post("/invites", response_model=InviteCreated, status_code=201)
def create_invite(
    actor: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.MEMBERSHIP_MANAGE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> InviteCreated:
    now = datetime.now(UTC)
    open_invites = session.scalar(
        select(func.count())
        .select_from(CompanyInvite)
        .where(
            CompanyInvite.company_id == actor.company_id,
            CompanyInvite.used_at.is_(None),
            CompanyInvite.revoked_at.is_(None),
            CompanyInvite.expires_at > now,
        )
    )
    if (open_invites or 0) >= MAX_OPEN_INVITES:
        raise BusinessConflict("Too many open invites. Revoke one first.")
    code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
    invite = CompanyInvite(
        company_id=actor.company_id,
        code_hash=_hash(code),
        code_hint=code[-4:],
        created_by=actor.user_id,
        expires_at=now + LIFETIME,
    )
    session.add(invite)
    session.flush()
    record_audit(
        session,
        actor_id=actor.user_id,
        company_id=actor.company_id,
        target_id=invite.id,
        action=AuditAction.INVITE_CREATED,
    )
    result = InviteCreated(
        id=invite.id, code=f"{code[:5]}-{code[5:]}", expires_at=invite.expires_at
    )
    session.commit()
    response.headers["Cache-Control"] = "no-store"
    return result


@router.get("/invites", response_model=list[InviteView])
def list_invites(
    actor: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.MEMBERSHIP_MANAGE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[InviteView]:
    response.headers["Cache-Control"] = "no-store"
    now = datetime.now(UTC)
    rows = session.scalars(
        select(CompanyInvite)
        .where(CompanyInvite.company_id == actor.company_id)
        .order_by(CompanyInvite.created_at.desc(), CompanyInvite.id)
        .limit(50)
    ).all()
    return [
        InviteView(
            id=row.id,
            code_hint=row.code_hint,
            status=_status(row, now),  # type: ignore[arg-type]
            expires_at=row.expires_at,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.delete("/invites/{invite_id}", status_code=204)
def revoke_invite(
    invite_id: UUID,
    actor: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.MEMBERSHIP_MANAGE))
    ],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    invite = session.scalars(
        select(CompanyInvite)
        .where(CompanyInvite.id == invite_id, CompanyInvite.company_id == actor.company_id)
        .with_for_update()
    ).one_or_none()
    if invite is None:
        raise HTTPException(404)
    if invite.used_at is not None:
        raise BusinessConflict("This invite has already been used.")
    if invite.revoked_at is None:
        invite.revoked_at = datetime.now(UTC)
        record_audit(
            session,
            actor_id=actor.user_id,
            company_id=actor.company_id,
            target_id=invite.id,
            action=AuditAction.INVITE_REVOKED,
        )
        session.commit()
    return Response(status_code=204)


@router.get("/members", response_model=list[MemberView])
def list_members(
    actor: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.MEMBERSHIP_MANAGE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[MemberView]:
    response.headers["Cache-Control"] = "no-store"
    rows = session.scalars(
        select(CompanyMembership)
        .where(CompanyMembership.company_id == actor.company_id)
        .order_by(CompanyMembership.created_at, CompanyMembership.id)
    ).all()
    return [MemberView.model_validate(row) for row in rows]


@accept_router.post("/accept", response_model=MembershipResponse, status_code=201)
def accept_invite(
    body: InviteAccept,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MembershipResponse:
    """Apply a code to the signed-in account; any unusable code gives the same 404."""
    session.execute(select(AppUser.id).where(AppUser.id == user.id).with_for_update())
    invite = session.scalars(
        select(CompanyInvite).where(CompanyInvite.code_hash == _hash(body.code)).with_for_update()
    ).one_or_none()
    if invite is None or _status(invite, datetime.now(UTC)) != "active":
        raise HTTPException(404, "This invite code is not valid.")
    belongs = session.scalar(
        select(func.count())
        .select_from(CompanyMembership)
        .where(CompanyMembership.user_id == user.id)
    )
    if belongs:
        raise BusinessConflict("This account already belongs to a company.")
    membership = CompanyMembership(
        user_id=user.id, company_id=invite.company_id, role=invite.role, status="active"
    )
    session.add(membership)
    session.flush()
    invite.used_at = datetime.now(UTC)
    invite.used_by = user.id
    record_audit(
        session,
        actor_id=user.id,
        company_id=invite.company_id,
        target_id=membership.id,
        action=AuditAction.MEMBERSHIP_ASSIGNED,
    )
    result = MembershipResponse.model_validate(membership)
    session.commit()
    return result
