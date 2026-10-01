"""Authenticated users can read their own application profile."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.users import CompanyMembershipSummary, CurrentUserResponse
from app.db.session import get_session
from app.models.company import Company, CompanyMembership
from app.models.user import AppUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CurrentUserResponse:
    response.headers["Cache-Control"] = "no-store"
    memberships = session.execute(
        select(CompanyMembership.company_id, Company.name, CompanyMembership.role)
        .join(Company, Company.id == CompanyMembership.company_id)
        .where(CompanyMembership.user_id == user.id, CompanyMembership.status == "active")
        .order_by(Company.name, Company.id)
    ).all()
    return CurrentUserResponse(
        id=user.id,
        role=user.role,
        created_at=user.created_at,
        memberships=[
            CompanyMembershipSummary(company_id=company_id, company_name=name, role=role)
            for company_id, name, role in memberships
        ],
    )
