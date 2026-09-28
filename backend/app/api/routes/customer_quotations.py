"""Customer-owned sent quotation history and decline operation."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.quotation_views import revision_view
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.quotations import QuotationRevisionView
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser

router = APIRouter(
    prefix="/users/me/requests/{request_id}/quotations", tags=["customer quotations"]
)


def require_customer_quote_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.QUOTATION_READ, user.role):
        raise HTTPException(403)
    return user


def require_customer_quote_decliner(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.QUOTATION_DECLINE, user.role):
        raise HTTPException(403)
    return user


def owned_quotation(
    session: Session, request_id: UUID, quotation_id: UUID, customer_id: UUID
) -> Quotation:
    quotation = session.scalars(
        select(Quotation)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(
            Quotation.id == quotation_id,
            QuotationRequest.id == request_id,
            QuotationRequest.customer_id == customer_id,
        )
    ).one_or_none()
    if quotation is None:
        raise HTTPException(404)
    return quotation


@router.get("/{quotation_id}/revisions", response_model=PageResponse[QuotationRevisionView])
def customer_revision_history(
    request_id: UUID,
    quotation_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[QuotationRevisionView]:
    response.headers["Cache-Control"] = "no-store"
    quotation = owned_quotation(session, request_id, quotation_id, user.id)
    scope = (
        QuotationRevision.quotation_id == quotation.id,
        QuotationRevision.sent_at.is_not(None),
    )
    total = session.scalar(select(func.count()).select_from(QuotationRevision).where(*scope)) or 0
    revisions = session.scalars(
        select(QuotationRevision)
        .where(*scope)
        .order_by(QuotationRevision.revision_number.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return PageResponse[QuotationRevisionView](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[revision_view(session, revision) for revision in revisions],
    )


@router.get("/{quotation_id}/revisions/{revision_id}", response_model=QuotationRevisionView)
def customer_revision_detail(
    request_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRevisionView:
    response.headers["Cache-Control"] = "no-store"
    quotation = owned_quotation(session, request_id, quotation_id, user.id)
    revision = session.scalars(
        select(QuotationRevision).where(
            QuotationRevision.id == revision_id,
            QuotationRevision.quotation_id == quotation.id,
            QuotationRevision.sent_at.is_not(None),
        )
    ).one_or_none()
    if revision is None:
        raise HTTPException(404)
    return revision_view(session, revision)


@router.post(
    "/{quotation_id}/revisions/{revision_id}/decline", response_model=QuotationRevisionView
)
def decline_quotation_revision(
    request_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_decliner)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRevisionView:
    response.headers["Cache-Control"] = "no-store"
    request = session.scalars(
        select(QuotationRequest)
        .where(
            QuotationRequest.id == request_id,
            QuotationRequest.customer_id == user.id,
        )
        .with_for_update()
    ).one_or_none()
    if request is None:
        raise HTTPException(404)
    quotation = owned_quotation(session, request_id, quotation_id, user.id)
    delivery = session.scalars(
        select(RequestDelivery).where(RequestDelivery.id == quotation.delivery_id).with_for_update()
    ).one()
    revision = session.scalars(
        select(QuotationRevision)
        .where(
            QuotationRevision.id == revision_id,
            QuotationRevision.quotation_id == quotation.id,
            QuotationRevision.sent_at.is_not(None),
        )
        .with_for_update()
    ).one_or_none()
    if revision is None:
        raise HTTPException(404)
    if request.status != "submitted" or delivery.status in {"closed", "cancelled"}:
        raise HTTPException(409, "This request is no longer active.")
    if (
        revision.status != "sent"
        or revision.valid_until is None
        or datetime.now(UTC) >= revision.valid_until
    ):
        raise HTTPException(409, "Only an active sent revision can be declined.")
    revision.status = "declined"
    session.commit()
    return revision_view(session, revision)
