"""Quotation lifecycle rules can be checked without persistence."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.quotation_states import QuotationState, can_start_revision, can_transition


def test_quotation_transitions_and_terminal_states():
    assert can_transition(QuotationState.DRAFT, QuotationState.SENT)
    assert can_transition(QuotationState.SENT, QuotationState.REVISED)
    for terminal in (
        QuotationState.REVISED,
        QuotationState.ACCEPTED,
        QuotationState.DECLINED,
        QuotationState.EXPIRED,
        QuotationState.WITHDRAWN,
    ):
        assert can_transition(QuotationState.SENT, terminal)
        assert not any(can_transition(terminal, state) for state in QuotationState)
    assert not can_transition(QuotationState.DRAFT, QuotationState.ACCEPTED)
    assert not can_transition(QuotationState.SENT, QuotationState.SENT)


def test_revision_eligibility_boundaries():
    now = datetime(2026, 1, 1, tzinfo=UTC)
    eligible = dict(
        valid_until=now + timedelta(seconds=1),
        now=now,
        request_active=True,
        delivery_active=True,
        draft_exists=False,
    )
    assert can_start_revision(QuotationState.SENT, **eligible)
    assert not can_start_revision(QuotationState.ACCEPTED, **eligible)
    assert not can_start_revision(QuotationState.REVISED, **eligible)
    assert not can_start_revision(QuotationState.SENT, **(eligible | {"valid_until": now}))
    for field in ("request_active", "delivery_active"):
        assert not can_start_revision(QuotationState.SENT, **(eligible | {field: False}))
    assert not can_start_revision(QuotationState.SENT, **(eligible | {"draft_exists": True}))
    with pytest.raises(ValueError):
        can_start_revision(QuotationState.SENT, **(eligible | {"now": now.replace(tzinfo=None)}))
