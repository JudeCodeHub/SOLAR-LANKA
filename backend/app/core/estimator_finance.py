"""Indicative net-metering finances; absent evidence yields absent outputs.

Tariff regimes model the full domestic bill, including consumption-dependent
energy blocks and fixed charges. No export cash is counted. The scenario uses
one representative month with zero opening energy credits, then annualises it;
actual weather, credit carry-forward, fees, and future tariffs may differ.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import (
    SizingEstimate,
    ValueRange,
    assumption_range,
    calculate_sizing,
    positive_decimal,
)
from app.models.estimator_config import EstimatorConfigVersion


@dataclass(frozen=True)
class FinancialEstimate:
    installed_cost_lkr: ValueRange[Decimal] | None
    baseline_monthly_bill_lkr: Decimal | None
    monthly_savings_lkr: ValueRange[Decimal] | None
    annual_savings_lkr: ValueRange[Decimal] | None
    simple_payback_years: ValueRange[Decimal] | None


def nonnegative(value: object, name: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not amount.is_finite() or amount < 0:
        raise ValueError(f"Invalid {name}")
    return amount


def installed_cost(
    sizing: SizingEstimate, config: EstimatorConfigVersion
) -> ValueRange[Decimal] | None:
    source = (
        config.source_metadata.get("cost") if isinstance(config.source_metadata, dict) else None
    )
    assumptions = config.assumptions
    if (
        not isinstance(source, dict)
        or source.get("basis") != "installer_quote"
        or not source.get("effective_from")
        or not source.get("url")
        or not isinstance(assumptions, dict)
        or assumptions.get("installed_cost_lkr_per_kwp") is None
        or assumptions.get("fixed_installation_cost_lkr") is None
    ):
        return None
    rate = assumption_range(assumptions["installed_cost_lkr_per_kwp"], "installed cost")
    fixed_raw = assumptions["fixed_installation_cost_lkr"]
    if not isinstance(fixed_raw, dict) or set(fixed_raw) != {"low", "high"}:
        raise ValueError("Invalid fixed installation cost")
    fixed = ValueRange(
        nonnegative(fixed_raw["low"], "fixed installation cost"),
        nonnegative(fixed_raw["high"], "fixed installation cost"),
    )
    if fixed.minimum > fixed.maximum:
        raise ValueError("Invalid fixed installation cost")
    if sizing.panel_count.maximum == 0:
        return ValueRange(Decimal(0), Decimal(0))
    return ValueRange(
        sizing.capacity_kwp.minimum * rate.minimum + fixed.minimum,
        sizing.capacity_kwp.maximum * rate.maximum + fixed.maximum,
    )


def monthly_bill(consumption_kwh: Decimal, tariff: dict) -> Decimal:
    """Bill a 30-day period using an explicit domestic regime and its blocks."""
    regimes = tariff.get("regimes")
    if not isinstance(regimes, list) or not regimes:
        raise ValueError("Invalid tariff regimes")
    selected = None
    for regime in regimes:
        if not isinstance(regime, dict):
            raise ValueError("Invalid tariff regime")
        start = nonnegative(regime.get("from_kwh"), "tariff threshold")
        end_raw = regime.get("through_kwh")
        end = None if end_raw is None else positive_decimal(end_raw, "tariff threshold")
        if end is not None and end < start:
            raise ValueError("Invalid tariff threshold")
        above_start = consumption_kwh >= start if start == 0 else consumption_kwh > start
        if above_start and (end is None or consumption_kwh <= end):
            if selected is not None:
                raise ValueError("Overlapping tariff regimes")
            selected = regime
    if selected is None:
        raise ValueError("Tariff does not cover consumption")
    blocks = selected.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("Invalid tariff blocks")
    energy = Decimal(0)
    previous = Decimal(0)
    for index, block in enumerate(blocks):
        if not isinstance(block, dict):
            raise ValueError("Invalid tariff block")
        limit_raw = block.get("through_kwh")
        limit = None if limit_raw is None else positive_decimal(limit_raw, "tariff block")
        if limit is None and index != len(blocks) - 1:
            raise ValueError("Invalid tariff block order")
        if limit is not None and limit <= previous:
            raise ValueError("Invalid tariff block order")
        rate = nonnegative(block.get("rate_lkr_per_kwh"), "tariff rate")
        upper = consumption_kwh if limit is None else min(consumption_kwh, limit)
        energy += max(upper - previous, Decimal(0)) * rate
        if limit is None or consumption_kwh <= limit:
            break
        previous = limit
    else:
        raise ValueError("Tariff blocks do not cover consumption")
    fixed = nonnegative(selected.get("fixed_charge_lkr"), "fixed charge")
    other = nonnegative(tariff.get("other_monthly_charge_lkr"), "other charge")
    tax_percent = nonnegative(tariff.get("tax_percent"), "tax percent")
    if tax_percent > 100:
        raise ValueError("Invalid tax percent")
    return (energy + fixed + other) * (1 + tax_percent / 100)


def calculate_financial(
    inputs: EstimatorInputs, config: EstimatorConfigVersion
) -> FinancialEstimate:
    """Return partial results only where published inputs support them."""
    sizing = calculate_sizing(inputs, config)
    cost = installed_cost(sizing, config)
    missing = FinancialEstimate(cost, None, None, None, None)
    source = config.source_metadata.get("tariff")
    tariff = config.assumptions.get("domestic_tariff")
    if (
        not isinstance(source, dict)
        or not source.get("url")
        or not source.get("effective_from")
        or not isinstance(tariff, dict)
        or inputs.daytime_consumption_percent is None
        or sizing.average_monthly_generation_kwh is None
    ):
        return missing
    consumption = inputs.monthly_consumption_kwh
    baseline = monthly_bill(consumption, tariff)
    generation = sizing.average_monthly_generation_kwh
    # Self-use + exported credits offset imports for net metering. Any excess
    # becomes an energy credit, never a cash payment in this scenario.
    low_bill = monthly_bill(max(consumption - generation.maximum, Decimal(0)), tariff)
    high_bill = monthly_bill(max(consumption - generation.minimum, Decimal(0)), tariff)
    monthly = ValueRange(baseline - high_bill, baseline - low_bill)
    annual = ValueRange(monthly.minimum * 12, monthly.maximum * 12)
    payback = None
    if cost is not None and annual.minimum > 0:
        payback = ValueRange(
            cost.minimum / annual.maximum,
            cost.maximum / annual.minimum,
        )
    return FinancialEstimate(cost, baseline, monthly, annual, payback)
