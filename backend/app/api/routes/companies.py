"""Private company profiles scoped to the acting staff member's company."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_company_reviewer
from app.api.errors import BusinessConflict
from app.api.schemas.companies import (
    CompanyProfileResponse,
    CompanyProfileUpdate,
    CompanyReviewDecision,
    CompanyReviewResponse,
    PublicCompanyResponse,
)
from app.api.schemas.pagination import PaginationParams
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import Company, CompanyMembership, CompanyReview
from app.models.user import AppUser

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
    company = session.scalars(
        select(Company).where(Company.id == membership.company_id).with_for_update()
    ).one()
    changes = body.model_dump(exclude_unset=True)
    if any(getattr(company, field) != value for field, value in changes.items()):
        # An approval covers the reviewed profile, never later unreviewed edits.
        company.publication_status = "draft"
    for field, value in changes.items():
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


@router.post("/{company_id}/review", response_model=CompanyReviewResponse, status_code=201)
def review_company(
    company_id: UUID,
    body: CompanyReviewDecision,
    reviewer: Annotated[AppUser, Depends(require_company_reviewer)],
    session: Annotated[Session, Depends(get_session)],
) -> CompanyReviewResponse:
    company = session.scalars(
        select(Company).where(Company.id == company_id).with_for_update()
    ).one_or_none()
    if company is None:
        raise HTTPException(404)
    if company.publication_status != "pending":
        raise BusinessConflict("Only pending submissions can be reviewed.")
    company.publication_status = body.outcome
    entry = CompanyReview(company_id=company.id, actor_id=reviewer.id, outcome=body.outcome)
    session.add(entry)
    session.flush()
    result = CompanyReviewResponse.model_validate(entry)
    session.commit()
    return result


public_router = APIRouter(prefix="/public/companies", tags=["public companies"])


@public_router.get("", response_model=list[PublicCompanyResponse])
def list_public_companies(
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> list[PublicCompanyResponse]:
    companies = session.scalars(
        select(Company)
        .where(Company.publication_status == "approved")
        .order_by(Company.name, Company.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    response.headers["Cache-Control"] = "no-store"
    return [PublicCompanyResponse.model_validate(company) for company in companies]


@public_router.get("/{company_id}", response_model=PublicCompanyResponse)
def read_public_company(
    company_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> PublicCompanyResponse:
    company = session.scalars(
        select(Company).where(Company.id == company_id, Company.publication_status == "approved")
    ).one_or_none()
    if company is None:
        raise HTTPException(404)
    response.headers["Cache-Control"] = "no-store"
    return PublicCompanyResponse.model_validate(company)
