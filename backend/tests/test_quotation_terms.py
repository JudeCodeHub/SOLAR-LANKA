"""Worked quotation total and expiry examples for the policy."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.core.quotation_terms import calculate_totals, check_validity_window, round_lkr, valid_at


def test_discount_precedes_tax_with_cent_rounding():
    lines = [round_lkr(Decimal("2") * Decimal("100.05")), Decimal("50.00")]
    subtotal = sum(lines)
    discount = round_lkr(subtotal * Decimal("0.10"))
    taxable = subtotal - discount
    tax = round_lkr(taxable * Decimal("0.18"))
    assert (subtotal, discount, taxable, tax, taxable + tax) == (
        Decimal("250.10"),
        Decimal("25.01"),
        Decimal("225.09"),
        Decimal("40.52"),
        Decimal("265.61"),
    )
    assert round_lkr(Decimal("0.005")) == Decimal("0.01")


def test_validity_boundaries():
    sent = datetime(2026, 1, 1, tzinfo=UTC)
    expiry = sent + timedelta(days=30)
    assert valid_at(sent, expiry, sent)
    assert valid_at(sent, expiry, expiry - timedelta(microseconds=1))
    assert not valid_at(sent, expiry, expiry)
    assert not valid_at(sent, expiry, sent - timedelta(microseconds=1))
    check_validity_window(sent, sent + timedelta(days=90))
    for invalid in (sent, sent - timedelta(seconds=1), sent + timedelta(days=90, seconds=1)):
        with pytest.raises(ValueError):
            check_validity_window(sent, invalid)
    with pytest.raises(ValueError):
        valid_at(sent, expiry, sent.replace(tzinfo=None))


def test_authoritative_totals_and_rounding():
    amounts = calculate_totals(
        [(Decimal("2"), Decimal("100.05")), (Decimal("1"), Decimal("50.00"))],
        discount_kind="percent",
        discount_value=Decimal("10"),
        tax_rate_percent=Decimal("18"),
    )
    assert amounts.line_totals == (Decimal("200.10"), Decimal("50.00"))
    assert amounts.subtotal == Decimal("250.10")
    assert amounts.discount == Decimal("25.01")
    assert amounts.tax == Decimal("40.52")
    assert amounts.total == Decimal("265.61")
    fixed = calculate_totals(
        [(Decimal("1"), Decimal("100.00"))],
        discount_kind="fixed",
        discount_value=Decimal("100.00"),
        tax_rate_percent=Decimal("18"),
    )
    assert fixed.total == Decimal("0.00")
    with pytest.raises(ValueError):
        calculate_totals(
            [(Decimal("1"), Decimal("100.00"))],
            discount_kind="fixed",
            discount_value=Decimal("100.01"),
            tax_rate_percent=Decimal("0"),
        )
