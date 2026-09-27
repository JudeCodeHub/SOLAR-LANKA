"""Private company profiles scoped to the acting staff member's company."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.schemas.companies import (
    CompanyProfileResponse,
    CompanyProfileUpdate,
    CompanyReviewResponse,
)
from app.api.schemas.pagination import PaginationParams
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import Company, CompanyMembership, CompanyReview

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


@router.post("/{company_id}/submit", response_model=CompanyReviewResponse, status_code=201)
def submit_company(
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.COMPANY_SUBMIT))
    ],
    session: Annotated[Session, Depends(get_session)],
) -> CompanyReviewResponse:
    company = session.scalars(
        select(Company).where(Company.id == membership.company_id).with_for_update()
    ).one()
    if company.publication_status not in {"draft", "rejected"}:
        raise BusinessConflict("Only draft or rejected companies can be submitted.")
    company.publication_status = "pending"
    entry = CompanyReview(company_id=company.id, actor_id=membership.user_id, outcome="submitted")
    session.add(entry)
    session.flush()
    result = CompanyReviewResponse.model_validate(entry)
    session.commit()
    return result


@router.get("/{company_id}/reviews", response_model=list[CompanyReviewResponse])
def company_review_history(
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.COMPANY_READ_PRIVATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> list[CompanyReviewResponse]:
    entries = session.scalars(
        select(CompanyReview)
        .where(CompanyReview.company_id == membership.company_id)
        .order_by(CompanyReview.created_at.desc(), CompanyReview.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    response.headers["Cache-Control"] = "no-store"
    return [CompanyReviewResponse.model_validate(entry) for entry in entries]
