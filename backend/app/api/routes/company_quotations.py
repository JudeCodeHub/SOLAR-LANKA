"""Recipient-scoped quotation history, replacement drafts, and withdrawal."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_membership
from app.api.quotation_views import revision_view
from app.api.routes.company_inbox import locked_active_delivery, scoped_delivery
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.quotations import QuotationDraftCreated, QuotationRevisionView
from app.core.permissions import Action, Scope, required_scopes
from app.core.quotation_states import QuotationState, can_start_revision
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision

router = APIRouter(
    prefix="/companies/{company_id}/request-deliveries/{delivery_id}/quotations",
    tags=["company quotations"],
)


def allowed(action: Action):
    def check(
        membership: Annotated[CompanyMembership, Depends(require_company_membership)],
    ) -> CompanyMembership:
        if Scope.DELIVERY_COMPANY not in required_scopes(action, membership.role):
            raise HTTPException(403)
        return membership

    return check


require_reader = allowed(Action.QUOTATION_READ)
require_reviser = allowed(Action.QUOTATION_REVISE)
require_withdrawer = allowed(Action.QUOTATION_WITHDRAW)


def scoped_quotation(session: Session, quotation_id: UUID, delivery_id: UUID) -> Quotation:
    quotation = session.scalars(
        select(Quotation).where(
            Quotation.id == quotation_id,
            Quotation.delivery_id == delivery_id,
        )
    ).one_or_none()
    if quotation is None:
        raise HTTPException(404)
    return quotation


@router.get("/{quotation_id}/revisions", response_model=PageResponse[QuotationRevisionView])
def company_revision_history(
    delivery_id: UUID,
    quotation_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[QuotationRevisionView]:
    response.headers["Cache-Control"] = "no-store"
    scoped_delivery(session, delivery_id, membership.company_id)
    quotation = scoped_quotation(session, quotation_id, delivery_id)
    scope = QuotationRevision.quotation_id == quotation.id
    total = session.scalar(select(func.count()).select_from(QuotationRevision).where(scope)) or 0
    revisions = session.scalars(
        select(QuotationRevision)
        .where(scope)
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
def company_revision_detail(
    delivery_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRevisionView:
    response.headers["Cache-Control"] = "no-store"
    scoped_delivery(session, delivery_id, membership.company_id)
    quotation = scoped_quotation(session, quotation_id, delivery_id)
    revision = session.scalars(
        select(QuotationRevision).where(
            QuotationRevision.id == revision_id,
            QuotationRevision.quotation_id == quotation.id,
        )
    ).one_or_none()
    if revision is None:
        raise HTTPException(404)
    return revision_view(session, revision)


@router.post("/{quotation_id}/revisions", status_code=201, response_model=QuotationDraftCreated)
def start_quotation_revision(
    delivery_id: UUID,
    quotation_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_reviser)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationDraftCreated:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    quotation = scoped_quotation(session, quotation_id, delivery.id)
    current = session.scalars(
        select(QuotationRevision)
        .where(
            QuotationRevision.quotation_id == quotation.id,
            QuotationRevision.status == "sent",
        )
        .with_for_update()
    ).one_or_none()
    draft_exists = (
        session.scalar(
            select(QuotationRevision.id).where(
                QuotationRevision.quotation_id == quotation.id,
                QuotationRevision.status == "draft",
            )
        )
        is not None
    )
    latest = session.scalars(
        select(QuotationRevision)
        .where(QuotationRevision.quotation_id == quotation.id)
        .order_by(QuotationRevision.revision_number.desc())
        .limit(1)
        .with_for_update()
    ).one_or_none()
    if draft_exists or latest is None:
        raise HTTPException(409, "A draft already exists or no revision can be restarted.")
    if current is None:
        if latest.status != "withdrawn" or latest.sent_at is not None:
            raise HTTPException(409, "A withdrawn sent offer cannot be restarted.")
    elif current.valid_until is None or not can_start_revision(
        QuotationState(current.status),
        valid_until=current.valid_until,
        now=datetime.now(UTC),
        request_active=True,
        delivery_active=True,
        draft_exists=False,
    ):
        raise HTTPException(409, "Only an active, unexpired sent offer can be revised.")
    number = latest.revision_number + 1
    if current is None:
        replacement = QuotationRevision(
            quotation_id=quotation.id, revision_number=number, status="draft", currency="LKR"
        )
    else:
        replacement = QuotationRevision(
            quotation_id=quotation.id,
            revision_number=number,
            status="draft",
            currency=current.currency,
            discount_kind=current.discount_kind,
            discount_value=current.discount_value,
            tax_rate_percent=current.tax_rate_percent,
            capacity_kwp=current.capacity_kwp,
            warranty_terms=current.warranty_terms,
            exclusions=current.exclusions,
            validity_days=current.validity_days,
            notes=current.notes,
            subtotal=current.subtotal,
            discount=current.discount,
            tax=current.tax,
            total=current.total,
        )
    session.add(replacement)
    session.flush()
    previous_lines = (
        list(
            session.scalars(
                select(QuotationLineItem)
                .where(QuotationLineItem.revision_id == current.id)
                .order_by(QuotationLineItem.position)
            )
        )
        if current is not None
        else []
    )
    session.add_all(
        [
            QuotationLineItem(
                revision_id=replacement.id,
                position=line.position,
                kind=line.kind,
                product_id=line.product_id,
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                line_total=line.line_total,
            )
            for line in previous_lines
        ]
    )
    session.commit()
    return QuotationDraftCreated(
        id=quotation.id,
        delivery_id=delivery.id,
        revision_id=replacement.id,
        revision_number=number,
        status="draft",
    )


@router.post(
    "/{quotation_id}/revisions/{revision_id}/withdraw", response_model=QuotationRevisionView
)
def withdraw_quotation_revision(
    delivery_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    membership: Annotated[CompanyMembership, Depends(require_withdrawer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRevisionView:
    response.headers["Cache-Control"] = "no-store"
    delivery, _ = locked_active_delivery(session, delivery_id, membership.company_id)
    quotation = scoped_quotation(session, quotation_id, delivery.id)
    revision = session.scalars(
        select(QuotationRevision)
        .where(
            QuotationRevision.id == revision_id,
            QuotationRevision.quotation_id == quotation.id,
        )
        .with_for_update()
    ).one_or_none()
    if revision is None:
        raise HTTPException(404)
    draft_exists = (
        session.scalar(
            select(QuotationRevision.id).where(
                QuotationRevision.quotation_id == quotation.id,
                QuotationRevision.status == "draft",
            )
        )
        is not None
    )
    if revision.status == "draft":
        latest_number = session.scalar(
            select(func.max(QuotationRevision.revision_number)).where(
                QuotationRevision.quotation_id == quotation.id
            )
        )
        if revision.revision_number != latest_number:
            raise HTTPException(409, "Only the current draft can be withdrawn.")
    elif revision.status == "sent":
        if (
            draft_exists
            or revision.valid_until is None
            or datetime.now(UTC) >= revision.valid_until
        ):
            raise HTTPException(409, "Only an active sent offer without a draft can be withdrawn.")
    else:
        raise HTTPException(409, "Only a draft or active sent offer can be withdrawn.")
    revision.status = "withdrawn"
    session.commit()
    return revision_view(session, revision)
