"""The estimator's sizing arithmetic matches independent written examples."""

from decimal import Decimal

import pytest

from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import ValueRange, calculate_sizing
from app.models.estimator_config import EstimatorConfigVersion


def example_config() -> EstimatorConfigVersion:
    return EstimatorConfigVersion(
        scenario="grid_net_metering_no_backup",
        version=1,
        status="published",
        assumptions={
            "panel_wattage_w": "500",
            "panel_area_m2": "2.5",
            "annual_yield_kwh_per_kwp": {"low": "1500", "high": "1500"},
            "shading_factors": {"partial": {"low": "0.8", "high": "0.8"}},
        },
        source_metadata={"yield": {"url": "https://example.org/fictional-yield"}},
    )


def example_inputs(area: str, *, shading: str | None = "partial") -> EstimatorInputs:
    return EstimatorInputs.model_validate({
        "monthly_consumption_kwh": "300",
        "district": "Colombo",
        "usable_roof_area_m2": area,
        "shading_condition": shading,
        "connection_scheme": "net_metering",
        "system_type": "on_grid",
        "backup_required": False,
    })


@pytest.mark.parametrize(
    ("area", "roof_count", "count", "capacity", "installed_area", "annual", "monthly"),
    [
        ("30", 12, 5, "2.5", "12.5", "3000", "250"),
        ("10", 4, 4, "2", "10", "2400", "200"),
    ],
)
def test_written_examples(area, roof_count, count, capacity, installed_area, annual, monthly):
    result = calculate_sizing(example_inputs(area), example_config())
    assert result.roof_panel_capacity == roof_count
    assert result.panel_count == ValueRange(count, count)
    assert result.capacity_kwp == ValueRange(Decimal(capacity), Decimal(capacity))
    assert result.installed_area_m2 == ValueRange(Decimal(installed_area), Decimal(installed_area))
    assert result.annual_generation_kwh == ValueRange(Decimal(annual), Decimal(annual))
    assert result.average_monthly_generation_kwh == ValueRange(
        Decimal(monthly), Decimal(monthly)
    )


def test_unknown_shading_is_not_assumed_zero_or_unshaded():
    result = calculate_sizing(example_inputs("30", shading=None), example_config())
    assert result.panel_count == ValueRange(5, 5)
    assert result.annual_generation_kwh is None
    assert result.average_monthly_generation_kwh is None


def test_distinct_sourced_yield_and_loss_bounds_produce_ranges():
    config = example_config()
    config.assumptions["annual_yield_kwh_per_kwp"] = {"low": "1200", "high": "1500"}
    config.assumptions["shading_factors"]["partial"] = {"low": "0.7", "high": "0.8"}
    result = calculate_sizing(example_inputs("30"), config)
    assert result.panel_count == ValueRange(5, 6)
    assert result.capacity_kwp == ValueRange(Decimal("2.5"), Decimal("3"))
    assert result.installed_area_m2 == ValueRange(Decimal("12.5"), Decimal("15"))
    assert result.annual_generation_kwh == ValueRange(Decimal("2100"), Decimal("3600"))


def test_zero_roof_area_is_zero_not_unknown():
    result = calculate_sizing(example_inputs("0", shading=None), example_config())
    assert result.panel_count == ValueRange(0, 0)
    assert result.annual_generation_kwh == ValueRange(Decimal(0), Decimal(0))
