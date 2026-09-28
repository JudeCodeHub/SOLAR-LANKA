"""Only the documented net-metering scenario is eligible for Phase 7 estimates."""

import pytest

from app.core.estimator_scenario import (
    DEFERRED_SCHEMES,
    DEFERRED_SYSTEM_TYPES,
    GRID_NET_METERING,
    ConnectionScheme,
    require_supported_scenario,
)


def test_grid_net_metering_without_backup_is_supported() -> None:
    scenario = require_supported_scenario(
        scheme="net_metering", system_type="on_grid", backup_required=False
    )
    assert scenario == GRID_NET_METERING
    assert scenario.excess_export_cash_payment is False
    assert scenario.source_url.startswith("https://www.pucsl.gov.lk/")


@pytest.mark.parametrize("scheme", sorted(DEFERRED_SCHEMES))
def test_other_grid_schemes_are_deferred(scheme: ConnectionScheme) -> None:
    with pytest.raises(ValueError, match="not supported"):
        require_supported_scenario(scheme=scheme, system_type="on_grid", backup_required=False)


@pytest.mark.parametrize("system_type", sorted(DEFERRED_SYSTEM_TYPES))
def test_off_grid_and_hybrid_are_deferred(system_type: str) -> None:
    with pytest.raises(ValueError, match="not supported"):
        require_supported_scenario(
            scheme="net_metering", system_type=system_type, backup_required=False
        )


@pytest.mark.parametrize("backup_required", [True, None, 0])
def test_backup_or_unknown_backup_need_is_deferred(backup_required: bool | None) -> None:
    with pytest.raises(ValueError, match="not supported"):
        require_supported_scenario(
            scheme="net_metering", system_type="on_grid", backup_required=backup_required
        )


def test_unknown_scheme_is_deferred() -> None:
    with pytest.raises(ValueError, match="not supported"):
        require_supported_scenario(scheme="unknown", system_type="on_grid", backup_required=False)
