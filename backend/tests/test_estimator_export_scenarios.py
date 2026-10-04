"""Net accounting and net plus are calculated individually from a dated, sourced feed-in rate."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.core.estimator_engine import ValueRange
from app.core.estimator_finance import calculate_financial
from app.core.estimator_scenario import (
    GRID_NET_ACCOUNTING,
    GRID_NET_PLUS,
    ConnectionScheme,
    require_supported_scenario,
)
from app.models.estimator_config import EstimatorConfigVersion
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from tests.test_estimate_preview import request_body
from tests.test_estimator_finance import financial_config, inputs_with_daytime

# PUCSL Decision on Feed in Tariffs, Annex 2: new rooftop solar up to 10 kW, effective 2026-08-25.
EXPORT_SOURCE = {
    "url": "https://www.pucsl.gov.lk/wp-content/uploads/2026/08/Full-Final-Decision-on-Feed-in-Tariffs-August-2026.pdf",
    "effective_from": "2026-08-25",
    "reviewed_on": "2026-10-04",
}


def export_config(scenario: str, rate: str = "23.11"):
    config = financial_config()
    config.scenario = scenario
    config.assumptions["export_rate_lkr_per_kwh"] = {"low": rate, "high": rate}
    config.source_metadata["export"] = dict(EXPORT_SOURCE)
    return config


def with_scheme(inputs, scheme: ConnectionScheme):
    return inputs.model_copy(update={"connection_scheme": scheme})


def test_both_schemes_are_supported_and_net_plus_plus_stays_deferred():
    for scheme, expected in (("net_accounting", GRID_NET_ACCOUNTING), ("net_plus", GRID_NET_PLUS)):
        found = require_supported_scenario(
            scheme=scheme, system_type="on_grid", backup_required=False
        )
        assert found == expected and found.excess_export_cash_payment is True
    with pytest.raises(ValueError, match="not supported"):
        require_supported_scenario(
            scheme="net_plus_plus", system_type="on_grid", backup_required=False
        )


def test_net_accounting_worked_example():
    # Worked by hand: 150 kWh used directly, 100 exported, so 5500 - 2500 + 2311 = 5311.
    config = export_config("grid_net_accounting_no_backup")
    inputs = with_scheme(inputs_with_daytime(), ConnectionScheme.NET_ACCOUNTING)
    result = calculate_financial(inputs, config)
    assert result.baseline_monthly_bill_lkr == Decimal("5500")
    assert result.monthly_savings_lkr == ValueRange(Decimal("5311.00"), Decimal("5311.00"))
    assert result.annual_savings_lkr == ValueRange(Decimal("63732.00"), Decimal("63732.00"))
    assert result.simple_payback_years.minimum == Decimal("250000") / Decimal("63732.00")


def test_net_accounting_is_not_the_net_metering_answer():
    config = export_config("grid_net_accounting_no_backup")
    inputs = with_scheme(inputs_with_daytime(), ConnectionScheme.NET_ACCOUNTING)
    # Net metering offsets the full 250 kWh against the bill (5090 in the 7.x worked example).
    assert calculate_financial(inputs, config).monthly_savings_lkr.minimum != Decimal("5090")


def test_net_accounting_needs_daytime_use_and_a_dated_rate():
    config = export_config("grid_net_accounting_no_backup")
    unknown = with_scheme(inputs_with_daytime(daytime=None), ConnectionScheme.NET_ACCOUNTING)
    assert calculate_financial(unknown, config).monthly_savings_lkr is None
    undated = export_config("grid_net_accounting_no_backup")
    del undated.source_metadata["export"]["effective_from"]
    known = with_scheme(inputs_with_daytime(), ConnectionScheme.NET_ACCOUNTING)
    assert calculate_financial(known, undated).monthly_savings_lkr is None
    no_rate = export_config("grid_net_accounting_no_backup")
    del no_rate.assumptions["export_rate_lkr_per_kwh"]
    assert calculate_financial(known, no_rate).monthly_savings_lkr is None


def test_net_plus_worked_example():
    # All 250 kWh are sold at 23.11 and the household still pays its normal bill.
    config = export_config("grid_net_plus_no_backup")
    inputs = with_scheme(inputs_with_daytime(daytime=None), ConnectionScheme.NET_PLUS)
    result = calculate_financial(inputs, config)
    assert result.baseline_monthly_bill_lkr == Decimal("5500")
    assert result.monthly_savings_lkr == ValueRange(Decimal("5777.50"), Decimal("5777.50"))
    assert result.annual_savings_lkr == ValueRange(Decimal("69330.00"), Decimal("69330.00"))


def test_a_config_for_another_scenario_is_refused():
    plain = financial_config()
    inputs = with_scheme(inputs_with_daytime(), ConnectionScheme.NET_PLUS)
    with pytest.raises(ValueError, match="published configuration"):
        calculate_financial(inputs, plain)


@pytest.mark.database
def test_saved_estimates_keep_their_scenario_rate_and_source(
    database_client, database_connection, database_session
):
    schema = f"export_scenarios_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, EstimatorConfigVersion, SavedEstimate):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_export_scenario")
    first = export_config("grid_net_accounting_no_backup")
    first.published_at = datetime.now(UTC)
    database_session.add_all([customer, first])
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_export_scenario", "session_test"
    )
    net_metering = {**request_body(), "monthly_bill_lkr": "0"}
    accounting = {**net_metering, "connection_scheme": "net_accounting"}
    # Each scheme only ever uses its own published configuration.
    assert database_client.post("/estimates/preview", json=net_metering).status_code == 503
    assert database_client.post("/users/me/estimates", json=net_metering).status_code == 503
    created = database_client.post("/users/me/estimates", json=accounting)
    assert created.status_code == 201
    saved_id = created.json()["id"]
    before = created.json()["estimate"]
    assert before["scenario"] == "grid_net_accounting_no_backup"
    assert before["sources"]["export"]["effective_from"] == "2026-08-25"

    # A newer version with a different rate changes new estimates, not the saved one.
    second = export_config("grid_net_accounting_no_backup", rate="20.00")
    second.version = 2
    second.published_at = datetime.now(UTC)
    database_session.add(second)
    database_session.commit()
    newer = database_client.post("/estimates/preview", json=accounting).json()
    assert newer["config_version"] == 2
    assert newer["financial"]["monthly_savings_lkr"] != before["financial"]["monthly_savings_lkr"]
    saved = database_session.scalars(select(SavedEstimate)).one()
    assert str(saved.id) == saved_id
    assert saved.result_snapshot == before
    assert saved.configuration_snapshot["version"] == 1
    assert saved.configuration_snapshot["assumptions"]["export_rate_lkr_per_kwh"]["low"] == "23.11"
    assert saved.configuration_snapshot["source_metadata"]["export"]["effective_from"] == (
        "2026-08-25"
    )
    assert saved.input_snapshot["connection_scheme"] == "net_accounting"


def test_admin_drafts_for_export_scenarios_need_a_dated_source_and_rate():
    from pydantic import ValidationError

    from app.api.schemas.estimator_config import EstimatorConfigDraft

    source = {
        "publisher": "P",
        "title": "T",
        "url": "https://example.org/x",
        "unit": "LKR/kWh",
        "reviewed_on": "2026-10-04",
        "limitation": "L",
    }
    base = {"yield": source, "tariff": source, "cost": source}
    draft = {"scenario": "grid_net_plus_no_backup", "assumptions": {"a": 1}}
    with pytest.raises(ValidationError):
        EstimatorConfigDraft.model_validate({**draft, "source_metadata": base})
    dated = {**source, "effective_from": "2026-08-25"}
    with pytest.raises(ValidationError):
        EstimatorConfigDraft.model_validate({**draft, "source_metadata": {**base, "export": dated}})
    rated = {**draft, "assumptions": {"export_rate_lkr_per_kwh": {"low": "1", "high": "2"}}}
    ok = EstimatorConfigDraft.model_validate(
        {**rated, "source_metadata": {**base, "export": dated}}
    )
    assert ok.scenario == "grid_net_plus_no_backup"
