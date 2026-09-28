"""Impossible inputs and unsupported backup requests cannot produce estimates."""

import pytest
from pydantic import ValidationError

from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import calculate_sizing
from app.core.estimator_finance import calculate_financial
from tests.test_estimator_engine import example_config, example_inputs


@pytest.mark.parametrize(
    "change",
    [
        {"backup_required": True},
        {"backup_required": 1},
        {"backup_required": "false"},
        {"system_type": "hybrid"},
        {"system_type": "off_grid"},
        {"connection_scheme": "net_plus"},
        {"monthly_consumption_kwh": "-1"},
        {"usable_roof_area_m2": "-0.01"},
        {"daytime_consumption_percent": "101"},
        {"daytime_consumption_percent": "-1"},
        {"monthly_consumption_kwh": "NaN"},
    ],
)
def test_impossible_or_unsupported_request_is_rejected(change):
    valid = example_inputs("30").model_dump(mode="python")
    with pytest.raises(ValidationError):
        EstimatorInputs.model_validate({**valid, **change})


@pytest.mark.parametrize("override", [{"backup_required": True}, {"system_type": "hybrid"}])
def test_engine_rechecks_internal_inputs_before_any_output(override):
    invalid = EstimatorInputs.model_construct(
        **{**example_inputs("30").model_dump(mode="python"), **override}
    )
    with pytest.raises(ValidationError):
        calculate_sizing(invalid, example_config())
    with pytest.raises(ValidationError):
        calculate_financial(invalid, example_config())


def test_zero_inputs_remain_valid_without_battery_sizing():
    values = example_inputs("0").model_dump(mode="python")
    values["monthly_consumption_kwh"] = 0
    inputs = EstimatorInputs.model_validate(values)
    result = calculate_sizing(inputs, example_config())
    assert result.panel_count.minimum == 0
    assert not hasattr(result, "battery_capacity_kwh")
