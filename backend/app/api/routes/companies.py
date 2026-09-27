"""Private company profiles scoped to the acting staff member's company."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.schemas.companies import CompanyProfileResponse, CompanyProfileUpdate
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import Company, CompanyMembership

router = APIRouter(prefix="/companies", tags=["companies"])


def _company(session: Session, membership: CompanyMembership) -> Company:
    company = session.get(Company, membership.company_id)
    if company is None:
        raise HTTPException(404)
    return company


@router.get("/{company_id}", response_model=CompanyProfileResponse)
def read_company_profile(
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.COMPANY_READ_PRIVATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CompanyProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    return CompanyProfileResponse.model_validate(_company(session, membership))


@router.patch("/{company_id}", response_model=CompanyProfileResponse)
def edit_company_profile(
    body: CompanyProfileUpdate,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.COMPANY_UPDATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CompanyProfileResponse:
    company = _company(session, membership)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    session.commit()
    response.headers["Cache-Control"] = "no-store"
    return CompanyProfileResponse.model_validate(company)
