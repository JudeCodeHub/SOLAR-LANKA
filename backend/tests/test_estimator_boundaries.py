"""Boundary and version scenarios for the Phase 7 estimator engine."""

from copy import deepcopy
from decimal import Decimal

import pytest

from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import ValueRange, calculate_sizing
from app.core.estimator_finance import calculate_financial
from tests.test_estimator_engine import example_config, example_inputs
from tests.test_estimator_finance import financial_config, inputs_with_daytime


def test_zero_consumption_keeps_zero_separate_from_unknown_generation():
    values = example_inputs("30", shading=None).model_dump(mode="python")
    values["monthly_consumption_kwh"] = Decimal(0)
    result = calculate_sizing(EstimatorInputs.model_validate(values), example_config())
    assert result.roof_panel_capacity == 12
    assert result.panel_count == ValueRange(0, 0)
    assert result.capacity_kwp == ValueRange(Decimal(0), Decimal(0))
    assert result.average_monthly_generation_kwh == ValueRange(Decimal(0), Decimal(0))


def test_zero_shading_factor_is_known_zero_but_unknown_shading_is_null():
    config = example_config()
    config.assumptions["shading_factors"]["partial"] = {"low": "0", "high": "0"}
    known = calculate_sizing(example_inputs("30"), config)
    unknown = calculate_sizing(example_inputs("30", shading=None), config)
    assert known.annual_generation_kwh == ValueRange(Decimal(0), Decimal(0))
    assert unknown.annual_generation_kwh is None


def test_roof_rounds_down_and_caps_target_without_exceeding_area():
    config = example_config()
    too_small = calculate_sizing(example_inputs("2.49"), config)
    exact_one = calculate_sizing(example_inputs("2.50"), config)
    assert too_small.panel_count == ValueRange(0, 0)
    assert exact_one.panel_count == ValueRange(1, 1)
    assert exact_one.installed_area_m2 == ValueRange(Decimal("2.5"), Decimal("2.5"))
    assert exact_one.installed_area_m2.maximum <= Decimal("2.50")


def test_new_config_version_changes_results_without_changing_old_snapshot():
    first = example_config()
    second = deepcopy(first)
    second.version = 2
    second.assumptions["annual_yield_kwh_per_kwp"] = {"low": "1000", "high": "1000"}
    first_before = calculate_sizing(example_inputs("30"), first)
    second_result = calculate_sizing(example_inputs("30"), second)
    assert first_before.panel_count == ValueRange(5, 5)
    assert second_result.panel_count == ValueRange(8, 8)
    assert second_result.annual_generation_kwh == ValueRange(Decimal("3200"), Decimal("3200"))
    assert calculate_sizing(example_inputs("30"), first) == first_before


def test_missing_or_draft_configuration_cannot_calculate():
    config = example_config()
    config.status = "draft"
    with pytest.raises(ValueError, match="published configuration"):
        calculate_sizing(example_inputs("30"), config)
    config.status = "published"
    config.source_metadata.clear()
    with pytest.raises(ValueError, match="sourced yield"):
        calculate_sizing(example_inputs("30"), config)


@pytest.mark.parametrize(
    "bad_yield",
    [{"low": "0", "high": "1500"}, {"low": "1600", "high": "1500"}],
)
def test_invalid_yield_bounds_are_rejected(bad_yield):
    config = example_config()
    config.assumptions["annual_yield_kwh_per_kwp"] = bad_yield
    with pytest.raises(ValueError, match="annual yield"):
        calculate_sizing(example_inputs("30"), config)


def test_cost_and_payback_change_only_with_a_new_eligible_quote():
    first = financial_config()
    baseline = calculate_financial(inputs_with_daytime(), first)
    second = deepcopy(first)
    second.version = 2
    second.assumptions["installed_cost_lkr_per_kwp"] = {"low": "200000", "high": "240000"}
    changed = calculate_financial(inputs_with_daytime(), second)
    assert changed.installed_cost_lkr == ValueRange(Decimal("500000"), Decimal("600000"))
    assert changed.simple_payback_years.minimum > baseline.simple_payback_years.minimum
    assert calculate_financial(inputs_with_daytime(), first) == baseline
    del second.source_metadata["cost"]["effective_from"]
    missing = calculate_financial(inputs_with_daytime(), second)
    assert missing.installed_cost_lkr is None
    assert missing.simple_payback_years is None
