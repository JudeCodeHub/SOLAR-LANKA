"""Company staff can read only deliveries addressed to their active company."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_membership
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.request_reads import (
    CompanyDeliveryDetail,
    CompanyInboxItem,
    CompanyNoteCreate,
    CompanyNoteResponse,
    DeliveryProgressUpdate,
)
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.request_delivery_note import RequestDeliveryNote

router = APIRouter(
    prefix="/companies/{company_id}/request-deliveries", tags=["company request inbox"]
)


def require_inbox_reader(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.DELIVERY_READ, membership.role):
        raise HTTPException(403)
    return membership


def require_delivery_updater(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.DELIVERY_UPDATE, membership.role):
        raise HTTPException(403)
    return membership


def require_note_reader(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.COMPANY_NOTE_READ, membership.role):
        raise HTTPException(403)
    return membership


def require_note_writer(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.COMPANY_NOTE_WRITE, membership.role):
        raise HTTPException(403)
    return membership


def scoped_delivery(
    session: Session, delivery_id: UUID, company_id: UUID, *, lock: bool = False
) -> RequestDelivery:
    query = select(RequestDelivery).where(
        RequestDelivery.id == delivery_id,
        RequestDelivery.company_id == company_id,
    )
    if lock:
        query = query.with_for_update()
    delivery = session.scalars(query).one_or_none()
    if delivery is None:
        raise HTTPException(404)
    return delivery


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


@router.patch("/{delivery_id}/progress", response_model=DeliveryProgressUpdate)
def update_delivery_progress(
    delivery_id: UUID,
    body: DeliveryProgressUpdate,
    membership: Annotated[CompanyMembership, Depends(require_delivery_updater)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> DeliveryProgressUpdate:
    response.headers["Cache-Control"] = "no-store"
    delivery = scoped_delivery(session, delivery_id, membership.company_id, lock=True)
    request = session.scalars(
        select(QuotationRequest).where(QuotationRequest.id == delivery.request_id).with_for_update()
    ).one()
    if request.status != "submitted" or delivery.status not in {
        "submitted", "viewed", "responding"
    }:
        raise HTTPException(409)
    if delivery.status == body.status:
        return body
    if delivery.status == "responding" and body.status == "viewed":
        raise HTTPException(409)
    if delivery.viewed_at is None:
        delivery.viewed_at = datetime.now(UTC)
    delivery.status = body.status
    session.commit()
    return body


@router.get("/{delivery_id}/notes", response_model=PageResponse[CompanyNoteResponse])
def list_delivery_notes(
    delivery_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_note_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[CompanyNoteResponse]:
    response.headers["Cache-Control"] = "no-store"
    scoped_delivery(session, delivery_id, membership.company_id)
    scope = RequestDeliveryNote.delivery_id == delivery_id
    total = session.scalar(
        select(func.count()).select_from(RequestDeliveryNote).where(scope)
    ) or 0
    notes = session.scalars(
        select(RequestDeliveryNote)
        .where(scope)
        .order_by(RequestDeliveryNote.created_at.desc(), RequestDeliveryNote.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return PageResponse[CompanyNoteResponse](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[CompanyNoteResponse.model_validate(note) for note in notes],
    )


@router.post("/{delivery_id}/notes", status_code=201, response_model=CompanyNoteResponse)
def add_delivery_note(
    delivery_id: UUID,
    body: CompanyNoteCreate,
    membership: Annotated[CompanyMembership, Depends(require_note_writer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CompanyNoteResponse:
    response.headers["Cache-Control"] = "no-store"
    delivery = scoped_delivery(session, delivery_id, membership.company_id)
    request = session.get(QuotationRequest, delivery.request_id)
    if request.status != "submitted" or delivery.status in {"closed", "cancelled"}:
        raise HTTPException(409)
    note = RequestDeliveryNote(
        delivery_id=delivery.id,
        author_id=membership.user_id,
        body=body.body,
    )
    session.add(note)
    session.commit()
    return CompanyNoteResponse.model_validate(note)
