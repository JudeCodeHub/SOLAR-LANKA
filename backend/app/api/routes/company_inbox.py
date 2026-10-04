"""Company staff can read only deliveries addressed to their active company."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_membership
from app.api.quotation_views import current_quotation_view
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.quotation_edit import (
    CurrentQuotation,
    DraftTermsInput,
    DraftTermsSaved,
    SentOfferRequired,
)
from app.api.schemas.quotations import (
    QuotationDraftCreated,
    QuotationSent,
    SentQuotationLine,
)
from app.api.schemas.request_reads import (
    CompanyDeliveryDetail,
    CompanyInboxItem,
    CompanyNoteCreate,
    CompanyNoteResponse,
    DeliveryClosureResponse,
    DeliveryProgressUpdate,
)
from app.core.permissions import Action, Scope, required_scopes
from app.core.quotation_terms import calculate_totals, check_validity_window
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
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


def require_quotation_drafter(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.QUOTATION_DRAFT, membership.role):
        raise HTTPException(403)
    return membership


def require_quotation_reader(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.QUOTATION_READ, membership.role):
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
    total = session.scalar(select(func.count()).select_from(RequestDelivery).where(scope)) or 0
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


def locked_active_delivery(
    session: Session, delivery_id: UUID, company_id: UUID
) -> tuple[RequestDelivery, QuotationRequest]:
    candidate = scoped_delivery(session, delivery_id, company_id)
    request = session.scalars(
        select(QuotationRequest)
        .where(QuotationRequest.id == candidate.request_id)
        .with_for_update()
    ).one()
    delivery = scoped_delivery(session, delivery_id, company_id, lock=True)
    if request.status != "submitted" or delivery.status in {"closed", "cancelled"}:
        raise HTTPException(409, "This delivery is no longer active.")
    return delivery, request


@router.post("/{delivery_id}/quotations", status_code=201, response_model=QuotationDraftCreated)
def create_quotation_draft(
    delivery_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_quotation_drafter)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationDraftCreated:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    if session.scalar(select(Quotation.id).where(Quotation.delivery_id == delivery.id)):
        raise HTTPException(409, "This delivery already has a quotation.")
    quotation = Quotation(delivery_id=delivery.id)
    session.add(quotation)
    session.flush()
    revision = QuotationRevision(
        quotation_id=quotation.id,
        request_id=delivery.request_id,
        revision_number=1,
        status="draft",
        currency="LKR",
    )
    session.add(revision)
    session.commit()
    return QuotationDraftCreated(
        id=quotation.id,
        delivery_id=delivery.id,
        revision_id=revision.id,
        revision_number=revision.revision_number,
        status="draft",
    )


@router.get("/{delivery_id}/quotations/current", response_model=CurrentQuotation)
def current_delivery_quotation(
    delivery_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_quotation_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CurrentQuotation:
    response.headers["Cache-Control"] = "no-store"
    scoped_delivery(session, delivery_id, membership.company_id)
    quotation = session.scalars(
        select(Quotation).where(Quotation.delivery_id == delivery_id)
    ).one_or_none()
    if quotation is None:
        raise HTTPException(404)
    revision = session.scalars(
        select(QuotationRevision)
        .where(QuotationRevision.quotation_id == quotation.id)
        .order_by(QuotationRevision.revision_number.desc())
        .limit(1)
    ).one()
    return current_quotation_view(session, quotation, revision)


@router.put("/{delivery_id}/quotations/{quotation_id}/draft", response_model=DraftTermsSaved)
def edit_quotation_draft(
    delivery_id: UUID,
    quotation_id: UUID,
    body: DraftTermsInput,
    membership: Annotated[CompanyMembership, Depends(require_quotation_drafter)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> DraftTermsSaved:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    quotation = session.scalars(
        select(Quotation).where(Quotation.id == quotation_id, Quotation.delivery_id == delivery.id)
    ).one_or_none()
    if quotation is None:
        raise HTTPException(404)
    revision = session.scalars(
        select(QuotationRevision)
        .where(QuotationRevision.quotation_id == quotation.id)
        .order_by(QuotationRevision.revision_number.desc())
        .limit(1)
        .with_for_update()
    ).one_or_none()
    if revision is None or revision.status != "draft":
        raise HTTPException(409, "Only the current draft can be edited.")
    product_ids = {line.product_id for line in body.lines if line.product_id is not None}
    if product_ids:
        products = list(session.scalars(select(Product).where(Product.id.in_(product_ids))))
        if len(products) != len(product_ids) or any(product.is_archived for product in products):
            raise HTTPException(422, "Equipment must reference active catalogue products.")
    try:
        totals = calculate_totals(
            [(line.quantity, line.unit_price) for line in body.lines],
            discount_kind=body.discount_kind,
            discount_value=body.discount_value,
            tax_rate_percent=body.tax_rate_percent,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    revision.subtotal = totals.subtotal
    revision.discount = totals.discount
    revision.tax = totals.tax
    revision.total = totals.total
    revision.discount_kind = body.discount_kind
    revision.discount_value = body.discount_value
    revision.tax_rate_percent = body.tax_rate_percent
    revision.capacity_kwp = body.capacity_kwp
    revision.warranty_terms = body.warranty_terms
    revision.exclusions = body.exclusions
    revision.validity_days = body.validity_days
    revision.notes = body.notes
    session.execute(delete(QuotationLineItem).where(QuotationLineItem.revision_id == revision.id))
    session.add_all(
        [
            QuotationLineItem(
                revision_id=revision.id,
                position=position,
                kind=line.kind,
                product_id=line.product_id,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                line_total=totals.line_totals[position - 1],
            )
            for position, line in enumerate(body.lines, start=1)
        ]
    )
    session.commit()
    return DraftTermsSaved(
        quotation_id=quotation.id,
        revision_id=revision.id,
        line_count=len(body.lines),
        subtotal=totals.subtotal,
        discount=totals.discount,
        tax=totals.tax,
        total=totals.total,
        status="draft",
    )


def require_quotation_sender(
    membership: Annotated[CompanyMembership, Depends(require_company_membership)],
) -> CompanyMembership:
    if Scope.DELIVERY_COMPANY not in required_scopes(Action.QUOTATION_SEND, membership.role):
        raise HTTPException(403)
    return membership


@router.post("/{delivery_id}/quotations/{quotation_id}/send", response_model=QuotationSent)
def send_quotation(
    delivery_id: UUID,
    quotation_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_quotation_sender)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationSent:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    quotation = session.scalars(
        select(Quotation).where(
            Quotation.id == quotation_id,
            Quotation.delivery_id == delivery.id,
        )
    ).one_or_none()
    if quotation is None:
        raise HTTPException(404)
    revision = session.scalars(
        select(QuotationRevision)
        .where(QuotationRevision.quotation_id == quotation.id)
        .order_by(QuotationRevision.revision_number.desc())
        .limit(1)
        .with_for_update()
    ).one_or_none()
    if revision is None or revision.status != "draft":
        raise HTTPException(409, "Only the current draft can be sent.")
    previous = session.scalars(
        select(QuotationRevision)
        .where(
            QuotationRevision.quotation_id == quotation.id,
            QuotationRevision.status == "sent",
        )
        .with_for_update()
    ).one_or_none()
    has_sent_history = (
        session.scalar(
            select(QuotationRevision.id)
            .where(
                QuotationRevision.quotation_id == quotation.id,
                QuotationRevision.sent_at.is_not(None),
            )
            .limit(1)
        )
        is not None
    )
    if has_sent_history and (
        previous is None
        or previous.valid_until is None
        or datetime.now(UTC) >= previous.valid_until
    ):
        raise HTTPException(409, "The prior sent offer is no longer eligible for revision.")
    try:
        required = SentOfferRequired.model_validate(revision)
    except ValidationError as error:
        raise HTTPException(
            422, "Capacity, warranty, exclusions, and validity are required."
        ) from error
    lines = list(
        session.scalars(
            select(QuotationLineItem)
            .where(QuotationLineItem.revision_id == revision.id)
            .order_by(QuotationLineItem.position)
            .with_for_update()
        )
    )
    if not lines:
        raise HTTPException(422, "A quotation needs at least one line.")
    try:
        totals = calculate_totals(
            [(line.quantity, line.unit_price) for line in lines],
            discount_kind=revision.discount_kind,
            discount_value=revision.discount_value,
            tax_rate_percent=revision.tax_rate_percent,
        )
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    product_ids = {line.product_id for line in lines if line.product_id is not None}
    products = (
        {
            product.id: product
            for product in session.scalars(
                select(Product).where(Product.id.in_(product_ids)).with_for_update(read=True)
            )
        }
        if product_ids
        else {}
    )
    if len(products) != len(product_ids) or any(
        product.is_archived for product in products.values()
    ):
        raise HTTPException(422, "Equipment must reference active catalogue products.")
    for line, amount in zip(lines, totals.line_totals, strict=True):
        line.line_total = amount
        if line.product_id is not None:
            product = products[line.product_id]
            line.product_snapshot = {
                "id": str(product.id),
                "kind": product.kind,
                "brand": product.brand,
                "model": product.model,
            }
    revision.subtotal = totals.subtotal
    revision.discount = totals.discount
    revision.tax = totals.tax
    revision.total = totals.total
    sent_at = datetime.now(UTC)
    valid_until = sent_at + timedelta(days=required.validity_days)
    check_validity_window(sent_at, valid_until)
    revision.sent_at = sent_at
    revision.valid_until = valid_until
    if previous is not None:
        previous.status = "revised"
    revision.status = "sent"
    session.add(
        OutboxEvent(
            event_key=f"quotation.sent:{revision.id}",
            event_type="quotation.sent",
            aggregate_kind="quotation_revision",
            aggregate_id=revision.id,
            payload={"version": 1, "revision_id": str(revision.id)},
        )
    )
    session.commit()
    return QuotationSent(
        id=quotation.id,
        revision_id=revision.id,
        revision_number=revision.revision_number,
        status="sent",
        sent_at=sent_at,
        valid_until=valid_until,
        capacity_kwp=format(required.capacity_kwp, ".3f"),
        warranty_terms=required.warranty_terms,
        exclusions=required.exclusions,
        notes=revision.notes,
        subtotal=format(totals.subtotal, ".2f"),
        discount=format(totals.discount, ".2f"),
        tax=format(totals.tax, ".2f"),
        total=format(totals.total, ".2f"),
        lines=[
            SentQuotationLine(
                position=line.position,
                kind=line.kind,
                product_id=line.product_id,
                product_snapshot=line.product_snapshot,
                description=line.description,
                quantity=format(line.quantity, ".3f"),
                unit_price=format(line.unit_price, ".2f"),
                line_total=format(line.line_total, ".2f"),
            )
            for line in lines
        ],
    )


@router.post("/{delivery_id}/close", response_model=DeliveryClosureResponse)
def close_delivery(
    delivery_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_delivery_updater)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> DeliveryClosureResponse:
    response.headers["Cache-Control"] = "no-store"
    delivery, request = locked_active_delivery(session, delivery_id, membership.company_id)
    delivery.status = "closed"
    session.flush()
    open_count = session.scalar(
        select(func.count())
        .select_from(RequestDelivery)
        .where(
            RequestDelivery.request_id == request.id,
            RequestDelivery.status != "closed",
        )
    )
    if open_count == 0:
        request.status = "closed"
    session.commit()
    return DeliveryClosureResponse(id=delivery.id, status="closed", request_status=request.status)


@router.patch("/{delivery_id}/progress", response_model=DeliveryProgressUpdate)
def update_delivery_progress(
    delivery_id: UUID,
    body: DeliveryProgressUpdate,
    membership: Annotated[CompanyMembership, Depends(require_delivery_updater)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> DeliveryProgressUpdate:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
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
    total = session.scalar(select(func.count()).select_from(RequestDeliveryNote).where(scope)) or 0
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
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    note = RequestDeliveryNote(
        delivery_id=delivery.id,
        author_id=membership.user_id,
        body=body.body,
    )
    session.add(note)
    session.commit()
    return CompanyNoteResponse.model_validate(note)
