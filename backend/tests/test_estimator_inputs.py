"""Estimator inputs preserve unknown values and explicit zeros."""

import pytest
from pydantic import ValidationError

from app.api.schemas.estimator_inputs import INPUT_CONTRACT, EstimatorInputs

BASE = {
    "monthly_consumption_kwh": "250",
    "district": "Colombo",
    "usable_roof_area_m2": "30",
    "connection_scheme": "net_metering",
    "system_type": "on_grid",
    "backup_required": False,
}


def test_contract_lists_required_fields_units_and_displayed_defaults() -> None:
    assert set(INPUT_CONTRACT) == set(EstimatorInputs.model_fields)
    for field, contract in INPUT_CONTRACT.items():
        assert EstimatorInputs.model_fields[field].is_required() == contract.required
    assert INPUT_CONTRACT["monthly_consumption_kwh"].unit == "kWh/month"
    assert INPUT_CONTRACT["usable_roof_area_m2"].unit == "m²"
    assert INPUT_CONTRACT["connection_scheme"].displayed_default == "Net metering"
    assert INPUT_CONTRACT["backup_required"].displayed_default == "No backup"


def test_unknown_and_zero_have_distinct_json_values() -> None:
    unknown = EstimatorInputs.model_validate(BASE)
    zero = EstimatorInputs.model_validate(
        {
            **BASE,
            "monthly_consumption_kwh": "0",
            "usable_roof_area_m2": "0",
            "daytime_consumption_percent": "0",
            "monthly_bill_lkr": "0",
        }
    )
    unknown_json = unknown.model_dump(mode="json")
    zero_json = zero.model_dump(mode="json")
    assert unknown_json["daytime_consumption_percent"] is None
    assert unknown_json["monthly_bill_lkr"] is None
    assert zero_json["daytime_consumption_percent"] == "0"
    assert zero_json["monthly_bill_lkr"] == "0.00"
    assert zero_json["monthly_consumption_kwh"] == "0"
    assert zero_json["usable_roof_area_m2"] == "0"


@pytest.mark.parametrize(
    "missing",
    [
        "monthly_consumption_kwh",
        "district",
        "usable_roof_area_m2",
        "connection_scheme",
        "system_type",
        "backup_required",
    ],
)
def test_required_inputs_cannot_be_silently_defaulted(missing: str) -> None:
    with pytest.raises(ValidationError):
        EstimatorInputs.model_validate(
            {key: value for key, value in BASE.items() if key != missing}
        )


@pytest.mark.parametrize(
    "change",
    [
        {"connection_scheme": "net_plus"},
        {"system_type": "hybrid"},
        {"backup_required": True},
    ],
)
def test_unsupported_scenarios_are_rejected(change: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        EstimatorInputs.model_validate({**BASE, **change})
