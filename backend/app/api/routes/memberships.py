"""Controlled assignment; existing grants require a separate explicit update flow."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.schemas.memberships import MembershipCreate, MembershipResponse
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.user import AppUser

router = APIRouter(prefix="/companies", tags=["memberships"])


@router.post("/{company_id}/memberships", response_model=MembershipResponse, status_code=201)
def assign_membership(
    body: MembershipCreate,
    actor: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.MEMBERSHIP_MANAGE))
    ],
    session: Annotated[Session, Depends(get_session)],
) -> MembershipResponse:
    if body.user_id == actor.user_id:
        raise HTTPException(403)
    target = session.get(AppUser, body.user_id)
    if target is None:
        raise HTTPException(404)
    if target.is_suspended or target.provider_state != "active":
        raise BusinessConflict("Membership cannot be assigned to an inactive account.")
    membership_id = session.scalar(
        insert(CompanyMembership)
        .values(user_id=target.id, company_id=actor.company_id, role=body.role, status="active")
        .on_conflict_do_nothing(constraint="uq_company_memberships_user_company")
        .returning(CompanyMembership.id)
    )
    if membership_id is None:
        raise BusinessConflict("This user already has a membership in this company.")
    membership = session.scalars(
        select(CompanyMembership).where(CompanyMembership.id == membership_id)
    ).one()
    response = MembershipResponse.model_validate(membership)
    session.commit()
    return response
