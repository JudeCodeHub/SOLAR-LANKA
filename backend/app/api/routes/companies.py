"""Private company profiles scoped to the acting staff member's company."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_company_reviewer
from app.api.errors import BusinessConflict
from app.api.schemas.companies import (
    CompanyProfileResponse,
    CompanyProfileUpdate,
    CompanyReviewDecision,
    CompanyReviewResponse,
    DirectoryQuery,
    PublicCompanyResponse,
)
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import Company, CompanyMembership, CompanyReview
from app.models.user import AppUser
from app.services.audit import AuditAction, record_audit
from app.services.public_media import public_media_for

router = APIRouter(prefix="/companies", tags=["companies"])
admin_router = APIRouter(prefix="/admin/companies", tags=["administration"])


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
        if company.publication_status != "draft":
            session.add(
                CompanyReview(
                    company_id=company.id,
                    actor_id=membership.user_id,
                    outcome="returned_to_draft",
                )
            )
        company.publication_status = "draft"
        record_audit(
            session,
            actor_id=membership.user_id,
            company_id=company.id,
            target_id=company.id,
            action=AuditAction.COMPANY_UPDATED,
        )
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
    record_audit(
        session,
        actor_id=entry.actor_id,
        company_id=company.id,
        target_id=company.id,
        action=AuditAction("company." + entry.outcome),
    )
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
    record_audit(
        session,
        actor_id=entry.actor_id,
        company_id=company.id,
        target_id=company.id,
        action=AuditAction("company." + entry.outcome),
    )
    session.commit()
    return result


public_router = APIRouter(prefix="/public/companies", tags=["public companies"])


@public_router.get("", response_model=PageResponse[PublicCompanyResponse])
def list_public_companies(
    session: Annotated[Session, Depends(get_session)],
    query: Annotated[DirectoryQuery, Query()],
    response: Response,
) -> PageResponse[PublicCompanyResponse]:
    conditions = [Company.publication_status == "approved"]
    if query.district is not None:
        conditions.append(Company.service_districts.contains([query.district]))
    if query.service is not None:
        conditions.append(Company.services.contains([query.service]))
    total = session.scalar(select(func.count()).select_from(Company).where(*conditions)) or 0
    companies = list(
        session.scalars(
            select(Company)
            .where(*conditions)
            .order_by(Company.name, Company.id)
            .limit(query.limit)
            .offset(query.offset)
        )
    )
    logos = public_media_for(
        session,
        parent_kind="company",
        parent_ids=[company.id for company in companies],
        categories=("company_logo",),
    )
    response.headers["Cache-Control"] = "no-store"
    return PageResponse[PublicCompanyResponse](
        items=[
            PublicCompanyResponse.model_validate(company).model_copy(
                update={"logo": next(iter(logos.get(company.id, [])), None)}
            )
            for company in companies
        ],
        total=total,
        limit=query.limit,
        offset=query.offset,
    )


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
    logos = public_media_for(
        session,
        parent_kind="company",
        parent_ids=[company.id],
        categories=("company_logo",),
    )
    response.headers["Cache-Control"] = "no-store"
    return PublicCompanyResponse.model_validate(company).model_copy(
        update={"logo": next(iter(logos.get(company.id, [])), None)}
    )


@admin_router.get("/pending", response_model=list[CompanyProfileResponse])
def pending_company_reviews(
    reviewer: Annotated[AppUser, Depends(require_company_reviewer)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> list[CompanyProfileResponse]:
    response.headers["Cache-Control"] = "no-store"
    rows = session.scalars(
        select(Company)
        .where(Company.publication_status == "pending")
        .order_by(Company.created_at, Company.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    return [CompanyProfileResponse.model_validate(row) for row in rows]


@admin_router.get("/{company_id}", response_model=CompanyProfileResponse)
def admin_company_profile(
    company_id: UUID,
    reviewer: Annotated[AppUser, Depends(require_company_reviewer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CompanyProfileResponse:
    response.headers["Cache-Control"] = "no-store"
    company = session.get(Company, company_id)
    if company is None:
        raise HTTPException(404)
    return CompanyProfileResponse.model_validate(company)


@admin_router.get("/{company_id}/reviews", response_model=list[CompanyReviewResponse])
def admin_company_review_history(
    company_id: UUID,
    reviewer: Annotated[AppUser, Depends(require_company_reviewer)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> list[CompanyReviewResponse]:
    response.headers["Cache-Control"] = "no-store"
    if session.get(Company, company_id) is None:
        raise HTTPException(404)
    entries = session.scalars(
        select(CompanyReview)
        .where(CompanyReview.company_id == company_id)
        .order_by(CompanyReview.created_at.desc(), CompanyReview.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    return [CompanyReviewResponse.model_validate(entry) for entry in entries]
