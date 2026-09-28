"""Quotation money and validity policy (Phase 9.02).

All quoted money is LKR represented by Decimal/JSON decimal strings to two
fractional places. Never calculate with binary floats. Quantities may have up
to three fractional places; unit prices have two. Round each quantity × unit
price line to cents with ROUND_HALF_UP, then sum the rounded lines. Apply one
nonnegative discount to that subtotal (fixed LKR or percentage, never both),
rounding a percentage discount once. Tax is calculated on the discounted
subtotal and rounded once. Total = subtotal - discount + tax. Neither discount
nor tax may make a component negative; discount cannot exceed subtotal.

Example: 2 × LKR 100.05 + 1 × LKR 50.00 = LKR 250.10 subtotal. A 10% discount
is LKR 25.01; taxable amount is LKR 225.09. An 18% tax is LKR 40.52, giving
LKR 265.61 total. With no tax, use zero tax explicitly, not an unknown rate.
Unknown taxes/charges cannot silently be treated as zero on a sent quote.

A sent revision stores both sent_at and valid_until as timezone-aware UTC
instants. valid_until must be strictly after sent_at and at most 90 days later.
It is valid at sent_at and immediately before valid_until; it expires exactly
at valid_until. For example, sent 2026-01-01T00:00:00Z and valid until
2026-01-31T00:00:00Z is valid at 2026-01-30T23:59:59Z, expired at
2026-01-31T00:00:00Z. Revisions never inherit or extend the prior expiry.
"""

from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from app.core.value_types import MONEY_UNIT

MAX_VALIDITY = timedelta(days=90)


def round_lkr(amount: Decimal) -> Decimal:
    return amount.quantize(MONEY_UNIT, rounding=ROUND_HALF_UP)


def check_validity_window(sent_at: datetime, valid_until: datetime) -> None:
    if sent_at.tzinfo is None or valid_until.tzinfo is None:
        raise ValueError("Quotation validity timestamps must include timezones.")
    duration = valid_until - sent_at
    if duration <= timedelta(0) or duration > MAX_VALIDITY:
        raise ValueError("Quotation validity must be after sending and within 90 days.")


def valid_at(sent_at: datetime, valid_until: datetime, now: datetime) -> bool:
    check_validity_window(sent_at, valid_until)
    if now.tzinfo is None:
        raise ValueError("Current time must include a timezone.")
    return sent_at <= now < valid_until
