"""Indicative capacity and generation ranges for the supported net-metering scenario."""

from dataclasses import dataclass
from decimal import ROUND_CEILING, ROUND_FLOOR, Decimal, InvalidOperation

from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_scenario import SUPPORTED_SCENARIOS
from app.models.estimator_config import EstimatorConfigVersion


@dataclass(frozen=True)
class ValueRange[T]:
    minimum: T
    maximum: T


@dataclass(frozen=True)
class SizingEstimate:
    panel_count: ValueRange[int]
    roof_panel_capacity: int
    capacity_kwp: ValueRange[Decimal]
    installed_area_m2: ValueRange[Decimal]
    annual_generation_kwh: ValueRange[Decimal] | None
    average_monthly_generation_kwh: ValueRange[Decimal] | None


def positive_decimal(value: object, name: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not number.is_finite() or number <= 0:
        raise ValueError(f"Invalid {name}")
    return number


def bounded_factor(value: object, name: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not number.is_finite() or not 0 <= number <= 1:
        raise ValueError(f"Invalid {name}")
    return number


def assumption_range(raw: object, name: str, *, factor: bool = False) -> ValueRange[Decimal]:
    if not isinstance(raw, dict) or set(raw) != {"low", "high"}:
        raise ValueError(f"Invalid {name}")
    parser = bounded_factor if factor else positive_decimal
    low = parser(raw["low"], name)
    high = parser(raw["high"], name)
    if low > high:
        raise ValueError(f"Invalid {name}")
    return ValueRange(low, high)


def calculate_sizing(inputs: EstimatorInputs, config: EstimatorConfigVersion) -> SizingEstimate:
    """Apply the hand-checkable 7.04 formulas without inventing missing values."""
    # Revalidate at the engine boundary.
    inputs = EstimatorInputs.model_validate(inputs.model_dump(mode="python"))
    if (
        config.status != "published"
        or config.scenario != SUPPORTED_SCENARIOS[inputs.connection_scheme].identifier
    ):
        raise ValueError("A published configuration for this scenario is required")
    if not isinstance(config.source_metadata, dict) or not config.source_metadata.get("yield"):
        raise ValueError("A sourced yield configuration is required")
    assumptions = config.assumptions
    if not isinstance(assumptions, dict):
        raise ValueError("Invalid assumptions")
    panel_watts = positive_decimal(assumptions.get("panel_wattage_w"), "panel wattage")
    panel_area = positive_decimal(assumptions.get("panel_area_m2"), "panel area")
    yield_range = assumption_range(assumptions.get("annual_yield_kwh_per_kwp"), "annual yield")
    panel_kwp = panel_watts / 1000
    roof_count = int(
        (inputs.usable_roof_area_m2 / panel_area).to_integral_value(rounding=ROUND_FLOOR)
    )

    def target_count(yield_value: Decimal) -> int:
        target_kwp = 12 * inputs.monthly_consumption_kwh / yield_value
        return int((target_kwp / panel_kwp).to_integral_value(rounding=ROUND_CEILING))

    minimum_count = min(roof_count, target_count(yield_range.maximum))
    maximum_count = min(roof_count, target_count(yield_range.minimum))
    count = ValueRange(minimum_count, maximum_count)
    capacity = ValueRange(minimum_count * panel_kwp, maximum_count * panel_kwp)
    area = ValueRange(minimum_count * panel_area, maximum_count * panel_area)
    generation = None
    monthly = None
    if maximum_count == 0:
        generation = ValueRange(Decimal(0), Decimal(0))
    elif inputs.shading_condition is not None:
        factors = assumptions.get("shading_factors")
        if not isinstance(factors, dict):
            raise ValueError("Invalid shading factors")
        factor = assumption_range(
            factors.get(inputs.shading_condition), "shading factor", factor=True
        )
        generation = ValueRange(
            capacity.minimum * yield_range.minimum * factor.minimum,
            capacity.maximum * yield_range.maximum * factor.maximum,
        )
    if generation is not None:
        monthly = ValueRange(generation.minimum / 12, generation.maximum / 12)
    return SizingEstimate(count, roof_count, capacity, area, generation, monthly)
