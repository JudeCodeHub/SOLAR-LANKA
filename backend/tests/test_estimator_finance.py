"""Fictional financial scenarios require explicit tariff, quote, and usage inputs."""

from decimal import Decimal

from app.core.estimator_engine import ValueRange
from app.core.estimator_finance import calculate_financial, monthly_bill
from tests.test_estimator_engine import example_config, example_inputs


def financial_config():
    config = example_config()
    config.assumptions["installed_cost_lkr_per_kwp"] = {"low": "100000", "high": "120000"}
    config.assumptions["fixed_installation_cost_lkr"] = {"low": "0", "high": "0"}
    config.assumptions["domestic_tariff"] = {
        "regimes": [
            {
                "from_kwh": "0",
                "through_kwh": "60",
                "blocks": [
                    {"through_kwh": "30", "rate_lkr_per_kwh": "5"},
                    {"through_kwh": "60", "rate_lkr_per_kwh": "9"},
                ],
                "fixed_charge_lkr": "80",
            },
            {
                "from_kwh": "60",
                "through_kwh": None,
                "blocks": [
                    {"through_kwh": "60", "rate_lkr_per_kwh": "10"},
                    {"through_kwh": None, "rate_lkr_per_kwh": "20"},
                ],
                "fixed_charge_lkr": "100",
            },
        ],
        "other_monthly_charge_lkr": "0",
        "tax_percent": "0",
    }
    config.source_metadata["cost"] = {
        "url": "https://example.org/fictional-quote",
        "basis": "installer_quote",
        "effective_from": "2026-09-28",
    }
    config.source_metadata["tariff"] = {
        "url": "https://example.org/fictional-tariff",
        "effective_from": "2026-09-28",
    }
    return config


def inputs_with_daytime(*, shading="partial", daytime="50"):
    inputs = example_inputs("30", shading=shading)
    daytime_percent = Decimal(daytime) if daytime is not None else None
    return inputs.model_copy(update={"daytime_consumption_percent": daytime_percent})


def test_full_bill_and_indicative_financial_scenario():
    config = financial_config()
    tariff = config.assumptions["domestic_tariff"]
    assert monthly_bill(Decimal("50"), tariff) == Decimal("410")
    assert monthly_bill(Decimal("300"), tariff) == Decimal("5500")
    assert monthly_bill(Decimal("60.0005"), tariff) > Decimal("0")
    result = calculate_financial(inputs_with_daytime(), config)
    assert result.installed_cost_lkr == ValueRange(Decimal("250000"), Decimal("300000"))
    assert result.baseline_monthly_bill_lkr == Decimal("5500")
    assert result.monthly_savings_lkr == ValueRange(Decimal("5090"), Decimal("5090"))
    assert result.annual_savings_lkr == ValueRange(Decimal("61080"), Decimal("61080"))
    assert result.simple_payback_years == ValueRange(
        Decimal("250000") / Decimal("61080"),
        Decimal("300000") / Decimal("61080"),
    )


def test_missing_quote_suppresses_cost_and_payback():
    config = financial_config()
    del config.source_metadata["cost"]
    result = calculate_financial(inputs_with_daytime(), config)
    assert result.installed_cost_lkr is None
    assert result.monthly_savings_lkr is not None
    assert result.simple_payback_years is None


def test_missing_tariff_or_daytime_or_generation_suppresses_savings():
    for missing in ("tariff", "schedule", "daytime", "shading"):
        config = financial_config()
        inputs = inputs_with_daytime()
        if missing == "tariff":
            del config.source_metadata["tariff"]
        elif missing == "schedule":
            del config.assumptions["domestic_tariff"]
        elif missing == "daytime":
            inputs = inputs_with_daytime(daytime=None)
        else:
            inputs = inputs_with_daytime(shading=None)
        result = calculate_financial(inputs, config)
        assert result.installed_cost_lkr is not None
        assert result.monthly_savings_lkr is None
        assert result.annual_savings_lkr is None
        assert result.simple_payback_years is None


def test_zero_savings_has_no_payback():
    config = financial_config()
    config.assumptions["shading_factors"]["partial"] = {"low": "0", "high": "0"}
    result = calculate_financial(inputs_with_daytime(), config)
    assert result.monthly_savings_lkr == ValueRange(Decimal(0), Decimal(0))
    assert result.simple_payback_years is None
