"""Expired, stale, withdrawn, and foreign revisions cannot be accepted."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from app.core.quotation_acceptance import (
    AcceptanceFacts,
    AcceptanceFailure,
    acceptance_failure,
)
from app.core.quotation_states import QuotationState

NOW = datetime(2026, 1, 1, 12, tzinfo=UTC)
ELIGIBLE = AcceptanceFacts(
    request_owned=True,
    revision_belongs_to_request=True,
    request_status="submitted",
    delivery_status="responding",
    revision_status=QuotationState.SENT,
    revision_is_current_sent=True,
    sent_at=NOW - timedelta(days=1),
    valid_until=NOW + timedelta(days=1),
    now=NOW,
    winner_exists=False,
)


def test_only_current_owned_sent_revision_is_eligible():
    assert acceptance_failure(ELIGIBLE) is None
    assert acceptance_failure(replace(ELIGIBLE, now=ELIGIBLE.sent_at)) is None
    assert acceptance_failure(replace(ELIGIBLE, now=ELIGIBLE.valid_until)) == (
        AcceptanceFailure.REVISION_INELIGIBLE
    )


@pytest.mark.parametrize(
    "change,expected",
    [
        ({"request_owned": False}, AcceptanceFailure.NOT_FOUND),
        ({"revision_belongs_to_request": False}, AcceptanceFailure.NOT_FOUND),
        ({"request_status": "cancelled"}, AcceptanceFailure.REQUEST_INACTIVE),
        ({"delivery_status": "closed"}, AcceptanceFailure.RECIPIENT_INACTIVE),
        ({"winner_exists": True}, AcceptanceFailure.WINNER_EXISTS),
        ({"revision_is_current_sent": False}, AcceptanceFailure.REVISION_INELIGIBLE),
        ({"sent_at": None}, AcceptanceFailure.REVISION_INELIGIBLE),
        ({"valid_until": None}, AcceptanceFailure.REVISION_INELIGIBLE),
        ({"now": NOW - timedelta(days=2)}, AcceptanceFailure.REVISION_INELIGIBLE),
        *[
            ({"revision_status": state}, AcceptanceFailure.REVISION_INELIGIBLE)
            for state in QuotationState
            if state is not QuotationState.SENT
        ],
    ],
)
def test_ineligible_exact_revision(change, expected):
    assert acceptance_failure(replace(ELIGIBLE, **change)) == expected


def test_naive_clock_is_rejected():
    with pytest.raises(ValueError):
        acceptance_failure(replace(ELIGIBLE, now=NOW.replace(tzinfo=None)))
