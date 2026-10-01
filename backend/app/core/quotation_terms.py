"""Quotation money and validity policy (Phase 9.02)."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, localcontext
from typing import Literal

from app.core.value_types import MONEY_MAX, MONEY_UNIT

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


@dataclass(frozen=True)
class QuotationTotals:
    line_totals: tuple[Decimal, ...]
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal


def calculate_totals(
    lines: Sequence[tuple[Decimal, Decimal]],
    *,
    discount_kind: Literal["none", "fixed", "percent"],
    discount_value: Decimal,
    tax_rate_percent: Decimal,
) -> QuotationTotals:
    """Calculate authoritative LKR amounts from validated quantity/price inputs."""
    if not lines or discount_value < 0 or not 0 <= tax_rate_percent <= 100:
        raise ValueError("Invalid quotation amounts.")
    with localcontext() as context:
        context.prec = 50
        line_totals = []
        for quantity, unit_price in lines:
            if quantity <= 0 or unit_price < 0:
                raise ValueError("Line quantity and price must be nonnegative.")
            line_total = round_lkr(quantity * unit_price)
            if line_total > MONEY_MAX:
                raise ValueError("Quotation line exceeds the supported money range.")
            line_totals.append(line_total)
        subtotal = sum(line_totals, Decimal("0.00"))
        if subtotal > MONEY_MAX:
            raise ValueError("Quotation subtotal exceeds the supported money range.")
        if discount_kind == "none":
            if discount_value != 0:
                raise ValueError("A no-discount quote must use zero discount.")
            discount = Decimal("0.00")
        elif discount_kind == "fixed":
            discount = round_lkr(discount_value)
        elif discount_kind == "percent":
            if discount_value > 100:
                raise ValueError("Percentage discount cannot exceed 100.")
            discount = round_lkr(subtotal * discount_value / 100)
        else:
            raise ValueError("Unknown discount type.")
        if discount > subtotal:
            raise ValueError("Discount cannot exceed the subtotal.")
        taxable = subtotal - discount
        tax = round_lkr(taxable * tax_rate_percent / 100)
        total = taxable + tax
        if total > MONEY_MAX:
            raise ValueError("Quotation total exceeds the supported money range.")
        return QuotationTotals(tuple(line_totals), subtotal, discount, tax, total)
