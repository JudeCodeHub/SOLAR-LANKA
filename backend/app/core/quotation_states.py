"""Quotation revision lifecycle policy (Phase 9.01)."""

from datetime import datetime
from enum import StrEnum


class QuotationState(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    REVISED = "revised"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    WITHDRAWN = "withdrawn"


ALLOWED_TRANSITIONS: dict[QuotationState, frozenset[QuotationState]] = {
    QuotationState.DRAFT: frozenset({QuotationState.SENT, QuotationState.WITHDRAWN}),
    QuotationState.SENT: frozenset(
        {
            QuotationState.REVISED,
            QuotationState.ACCEPTED,
            QuotationState.DECLINED,
            QuotationState.EXPIRED,
            QuotationState.WITHDRAWN,
        }
    ),
    QuotationState.REVISED: frozenset(),
    QuotationState.ACCEPTED: frozenset(),
    QuotationState.DECLINED: frozenset(),
    QuotationState.EXPIRED: frozenset(),
    QuotationState.WITHDRAWN: frozenset(),
}


def can_transition(current: QuotationState, target: QuotationState) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def can_start_revision(
    current: QuotationState,
    *,
    valid_until: datetime,
    now: datetime,
    request_active: bool,
    delivery_active: bool,
    draft_exists: bool,
) -> bool:
    """Check state eligibility; caller must separately verify company ownership."""
    if valid_until.tzinfo is None or now.tzinfo is None:
        raise ValueError("Quotation validity and current time must include timezones.")
    return (
        current is QuotationState.SENT
        and now < valid_until
        and request_active
        and delivery_active
        and not draft_exists
    )
