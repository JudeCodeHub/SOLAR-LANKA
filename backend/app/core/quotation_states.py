"""Quotation revision lifecycle policy (Phase 9.01).

A quotation is addressed to one request delivery. Its first revision starts as
DRAFT. Sending freezes that revision and makes it SENT. Editing after send
requires a new DRAFT revision; the previous SENT revision becomes REVISED only
when the replacement is sent. Abandoning a replacement draft leaves the sent
revision active.

Allowed transitions:
    DRAFT -> SENT or WITHDRAWN (discard an unsent draft)
    SENT -> REVISED, ACCEPTED, DECLINED, EXPIRED, or WITHDRAWN
    REVISED, ACCEPTED, DECLINED, EXPIRED, WITHDRAWN -> none

Only a SENT, unexpired revision can be revised or accepted. A company may start
one replacement draft for its own active SENT revision while its request and
recipient delivery are active. A customer may decline a SENT revision; the
company may withdraw it. Expiry is determined from the sent revision's validity
instant, not a browser clock. ACCEPTED is final; a later revision cannot replace
it. Historical terminal revisions remain readable to authorised parties.

The request/delivery ownership checks and any competing-offer acceptance lock
are separate requirements enforced by the API/transaction layers.
"""

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
