"""Lock and recheck an exact quotation revision before accepting it.

The caller owns the Session transaction. This function flushes the accepted
status but never commits, so the installation can be inserted and committed
atomically by the later acceptance endpoint.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.quotation_acceptance import (
    AcceptanceFacts,
    AcceptanceFailure,
    acceptance_failure,
)
from app.core.quotation_states import QuotationState
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery


class AcceptanceRejected(Exception):
    def __init__(self, failure: AcceptanceFailure) -> None:
        self.failure = failure
        super().__init__(failure.value)


def accept_revision_in_transaction(
    session: Session,
    *,
    customer_id: UUID,
    request_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    now: datetime | None = None,
) -> QuotationRevision:
    """Lock request -> delivery -> revision, validate, then flush status only."""
    request = session.scalars(
        select(QuotationRequest)
        .where(QuotationRequest.id == request_id, QuotationRequest.customer_id == customer_id)
        .with_for_update()
    ).one_or_none()
    if request is None:
        raise AcceptanceRejected(AcceptanceFailure.NOT_FOUND)
    target = session.execute(
        select(Quotation.id, RequestDelivery.id)
        .select_from(QuotationRevision)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .where(
            QuotationRevision.id == revision_id,
            Quotation.id == quotation_id,
            QuotationRevision.request_id == request.id,
            RequestDelivery.request_id == request.id,
        )
    ).one_or_none()
    if target is None:
        raise AcceptanceRejected(AcceptanceFailure.NOT_FOUND)
    _, delivery_id = target
    delivery = session.scalars(
        select(RequestDelivery).where(RequestDelivery.id == delivery_id).with_for_update()
    ).one()
    revision = session.scalars(
        select(QuotationRevision).where(QuotationRevision.id == revision_id).with_for_update()
    ).one()
    current_sent_id = session.scalar(
        select(QuotationRevision.id)
        .where(
            QuotationRevision.quotation_id == quotation_id,
            QuotationRevision.status == "sent",
        )
        .order_by(QuotationRevision.revision_number.desc())
        .limit(1)
    )
    winner_exists = (
        session.scalar(
            select(QuotationRevision.id)
            .where(
                QuotationRevision.request_id == request.id,
                QuotationRevision.status == "accepted",
            )
            .limit(1)
        )
        is not None
    )
    failure = acceptance_failure(
        AcceptanceFacts(
            request_owned=True,
            revision_belongs_to_request=True,
            request_status=request.status,
            delivery_status=delivery.status,
            revision_status=QuotationState(revision.status),
            revision_is_current_sent=current_sent_id == revision.id,
            sent_at=revision.sent_at,
            valid_until=revision.valid_until,
            now=now or datetime.now(UTC),
            winner_exists=winner_exists,
        )
    )
    if failure is not None:
        raise AcceptanceRejected(failure)
    revision.status = "accepted"
    session.flush()
    return revision
