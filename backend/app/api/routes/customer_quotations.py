"""Customer-owned sent quotation history and decline operation."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.quotation_views import revision_view
from app.api.schemas.offer_comparison import (
    ComparisonEquipment,
    ComparisonInclusions,
    ComparisonOffer,
    OfferComparison,
)
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.quotations import AcceptedInstallation, QuotationRevisionView
from app.core.installation_milestones import SEQUENCE
from app.core.permissions import Action, Scope, required_scopes
from app.core.quotation_acceptance import AcceptanceFailure
from app.db.session import get_session
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser
from app.services.quotation_acceptance import (
    AcceptanceRejected,
    accept_revision_in_transaction,
)

router = APIRouter(
    prefix="/users/me/requests/{request_id}/quotations", tags=["customer quotations"]
)


def require_customer_quote_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.QUOTATION_READ, user.role):
        raise HTTPException(403)
    return user


def require_customer_quote_comparer(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.QUOTATION_COMPARE, user.role):
        raise HTTPException(403)
    return user


def require_customer_quote_acceptor(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.QUOTATION_ACCEPT, user.role):
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


@router.get("/compare", response_model=OfferComparison)
def compare_current_offers(
    request_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_comparer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> OfferComparison:
    response.headers["Cache-Control"] = "no-store"
    request = session.scalars(
        select(QuotationRequest).where(
            QuotationRequest.id == request_id,
            QuotationRequest.customer_id == user.id,
        )
    ).one_or_none()
    if request is None:
        raise HTTPException(404)
    if request.status != "submitted":
        return OfferComparison(request_id=request.id, offers=[])
    rows = list(
        session.execute(
            select(Quotation, RequestDelivery, QuotationRevision)
            .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
            .join(QuotationRevision, QuotationRevision.quotation_id == Quotation.id)
            .where(
                RequestDelivery.request_id == request.id,
                RequestDelivery.status.not_in(("closed", "cancelled")),
                QuotationRevision.status == "sent",
                QuotationRevision.sent_at.is_not(None),
                QuotationRevision.valid_until > datetime.now(UTC),
            )
            .order_by(RequestDelivery.company_id, QuotationRevision.revision_number.desc())
        )
    )
    revision_ids = [revision.id for _, _, revision in rows]
    lines_by_revision: dict[UUID, list[QuotationLineItem]] = {
        revision_id: [] for revision_id in revision_ids
    }
    if revision_ids:
        lines = session.scalars(
            select(QuotationLineItem)
            .where(QuotationLineItem.revision_id.in_(revision_ids))
            .order_by(QuotationLineItem.position)
        )
        for line in lines:
            lines_by_revision[line.revision_id].append(line)
    offers = []
    for quotation, delivery, revision in rows:
        equipment = []
        included = set()
        for line in lines_by_revision[revision.id]:
            if line.kind != "equipment":
                continue
            snapshot = line.product_snapshot or {}
            kind = snapshot.get("kind")
            if kind not in {"panel", "inverter"}:
                kind = None
            if kind is not None:
                included.add(kind)
            equipment.append(
                ComparisonEquipment(
                    product_id=line.product_id,
                    kind=kind,
                    brand=snapshot.get("brand"),
                    model=snapshot.get("model"),
                    description=line.description,
                    quantity=line.quantity,
                    line_total_lkr=line.line_total,
                )
            )
        offers.append(
            ComparisonOffer(
                quotation_id=quotation.id,
                revision_id=revision.id,
                company_id=delivery.company_id,
                sent_at=revision.sent_at,
                valid_until=revision.valid_until,
                total_lkr=revision.total,
                capacity_kwp=revision.capacity_kwp,
                warranty_terms=revision.warranty_terms,
                exclusions=revision.exclusions,
                equipment=equipment,
                inclusions=ComparisonInclusions(
                    panel_equipment="included" if "panel" in included else "not_specified",
                    inverter_equipment="included" if "inverter" in included else "not_specified",
                ),
            )
        )
    return OfferComparison(request_id=request.id, offers=offers)


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


@router.post(
    "/{quotation_id}/revisions/{revision_id}/accept",
    status_code=201,
    response_model=AcceptedInstallation,
)
def accept_quotation_revision(
    request_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_acceptor)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AcceptedInstallation:
    response.headers["Cache-Control"] = "no-store"
    try:
        revision = accept_revision_in_transaction(
            session,
            customer_id=user.id,
            request_id=request_id,
            quotation_id=quotation_id,
            revision_id=revision_id,
        )
        installation = Installation(accepted_revision_id=revision.id)
        session.add(installation)
        session.flush()
        session.add_all(
            InstallationMilestoneRecord(
                installation_id=installation.id,
                position=position,
                kind=milestone.value,
                status="in_progress" if position == 1 else "pending",
            )
            for position, milestone in enumerate(SEQUENCE, start=1)
        )
        session.commit()
    except AcceptanceRejected as error:
        if error.failure is AcceptanceFailure.WINNER_EXISTS:
            existing = session.scalar(
                select(Installation)
                .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
                .where(
                    Installation.accepted_revision_id == revision_id,
                    QuotationRevision.quotation_id == quotation_id,
                    QuotationRevision.request_id == request_id,
                    QuotationRevision.status == "accepted",
                )
            )
            if existing is not None:
                installation_id = existing.id
                session.rollback()
                response.status_code = 200
                return AcceptedInstallation(
                    installation_id=installation_id,
                    request_id=request_id,
                    revision_id=revision_id,
                    status="accepted",
                )
        session.rollback()
        status = 404 if error.failure is AcceptanceFailure.NOT_FOUND else 409
        raise HTTPException(status, error.failure.value) from error
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(409, "Acceptance could not be completed.") from error
    except Exception:
        session.rollback()
        raise
    return AcceptedInstallation(
        installation_id=installation.id,
        request_id=request_id,
        revision_id=revision.id,
        status="accepted",
    )
