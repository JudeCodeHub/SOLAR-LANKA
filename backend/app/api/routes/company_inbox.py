"""Company staff can read only deliveries addressed to their active company."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_membership
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.request_reads import CompanyDeliveryDetail, CompanyInboxItem
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.quotation_request import QuotationRequest, RequestDelivery

router = APIRouter(
    prefix="/companies/{company_id}/request-deliveries", tags=["company request inbox"]
)


def require_inbox_reader(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.DELIVERY_READ, membership.role):
        raise HTTPException(403)
    return membership


def inbox_item(delivery: RequestDelivery, request: QuotationRequest) -> CompanyInboxItem:
    return CompanyInboxItem(
        id=delivery.id,
        request_id=request.id,
        status=delivery.status,
        created_at=delivery.created_at,
        district=request.requirements["district"],
    )


@router.get("", response_model=PageResponse[CompanyInboxItem])
def company_inbox(
    membership: Annotated[CompanyMembership, Depends(require_inbox_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[CompanyInboxItem]:
    response.headers["Cache-Control"] = "no-store"
    scope = RequestDelivery.company_id == membership.company_id
    total = session.scalar(
        select(func.count()).select_from(RequestDelivery).where(scope)
    ) or 0
    rows = session.execute(
        select(RequestDelivery, QuotationRequest)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(scope)
        .order_by(RequestDelivery.created_at.desc(), RequestDelivery.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return PageResponse[CompanyInboxItem](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[inbox_item(delivery, request) for delivery, request in rows],
    )


@router.get("/{delivery_id}", response_model=CompanyDeliveryDetail)
def company_delivery_detail(
    delivery_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_inbox_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CompanyDeliveryDetail:
    response.headers["Cache-Control"] = "no-store"
    row = session.execute(
        select(RequestDelivery, QuotationRequest)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(
            RequestDelivery.id == delivery_id,
            RequestDelivery.company_id == membership.company_id,
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404)
    delivery, request = row
    return CompanyDeliveryDetail(
        **inbox_item(delivery, request).model_dump(),
        viewed_at=delivery.viewed_at,
        requirements=request.requirements,
    )
