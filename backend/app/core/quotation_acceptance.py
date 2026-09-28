"""Exact-revision acceptance eligibility for the future atomic accept operation.

The caller must load the requested revision by its supplied ID, join its
quotation through the recipient delivery to the request, and check the
request's customer ID against the authenticated user. A foreign request or
revision returns NOT_FOUND without revealing whether an offer exists.

An eligible revision is the current SENT revision for an active recipient
on an active request. Its sent_at <= now < valid_until, with timezone-aware
instants. Draft, superseded/revised, withdrawn, declined, expired, and already
accepted revisions are ineligible. No other revision may have won the request.
The accept operation must recheck these facts while holding its write locks;
this pure policy alone does not protect against concurrent acceptance.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.core.quotation_states import QuotationState


class AcceptanceFailure(StrEnum):
    NOT_FOUND = "not_found"
    REQUEST_INACTIVE = "request_inactive"
    RECIPIENT_INACTIVE = "recipient_inactive"
    WINNER_EXISTS = "winner_exists"
    REVISION_INELIGIBLE = "revision_ineligible"


@dataclass(frozen=True)
class AcceptanceFacts:
    request_owned: bool
    revision_belongs_to_request: bool
    request_status: str
    delivery_status: str
    revision_status: QuotationState
    revision_is_current_sent: bool
    sent_at: datetime | None
    valid_until: datetime | None
    now: datetime
    winner_exists: bool


def acceptance_failure(facts: AcceptanceFacts) -> AcceptanceFailure | None:
    """Return a failure code, or None only when this exact revision is eligible."""
    if not facts.request_owned or not facts.revision_belongs_to_request:
        return AcceptanceFailure.NOT_FOUND
    if facts.request_status != "submitted":
        return AcceptanceFailure.REQUEST_INACTIVE
    if facts.delivery_status not in {"submitted", "viewed", "responding"}:
        return AcceptanceFailure.RECIPIENT_INACTIVE
    if facts.winner_exists:
        return AcceptanceFailure.WINNER_EXISTS
    if (
        facts.revision_status is not QuotationState.SENT
        or not facts.revision_is_current_sent
        or facts.sent_at is None
        or facts.valid_until is None
    ):
        return AcceptanceFailure.REVISION_INELIGIBLE
    if any(value.tzinfo is None for value in (facts.sent_at, facts.valid_until, facts.now)):
        raise ValueError("Acceptance timestamps must include timezones.")
    if not facts.sent_at <= facts.now < facts.valid_until:
        return AcceptanceFailure.REVISION_INELIGIBLE
    return None
