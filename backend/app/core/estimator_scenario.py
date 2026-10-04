"""Estimator boundary: grid-connected, no-backup scenarios that are individually sourced."""

from dataclasses import dataclass
from enum import StrEnum


class ConnectionScheme(StrEnum):
    NET_METERING = "net_metering"
    NET_ACCOUNTING = "net_accounting"
    NET_PLUS = "net_plus"
    NET_PLUS_PLUS = "net_plus_plus"


# Net plus plus is a separate power-plant arrangement (installations above contract demand,
# roof rental, aggregators) that this household estimator does not model.
DEFERRED_SCHEMES = frozenset({ConnectionScheme.NET_PLUS_PLUS})
DEFERRED_SYSTEM_TYPES = frozenset({"off_grid", "hybrid"})


@dataclass(frozen=True)
class SupportedScenario:
    identifier: str
    scheme: ConnectionScheme
    system_type: str
    backup_required: bool
    excess_export_cash_payment: bool
    source_url: str
    source_reviewed_on: str


GRID_NET_METERING = SupportedScenario(
    identifier="grid_net_metering_no_backup",
    scheme=ConnectionScheme.NET_METERING,
    system_type="on_grid",
    backup_required=False,
    excess_export_cash_payment=False,
    source_url="https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/",
    source_reviewed_on="2026-09-28",
)


# Verified against the page as it read on the review date; its own note says it was last
# updated 2023-10-10 and lists feed-in rates "as of July 1, 2024", so rates need rechecking.
GRID_NET_ACCOUNTING = SupportedScenario(
    identifier="grid_net_accounting_no_backup",
    scheme=ConnectionScheme.NET_ACCOUNTING,
    system_type="on_grid",
    backup_required=False,
    excess_export_cash_payment=True,
    source_url="https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/",
    source_reviewed_on="2026-10-04",
)

GRID_NET_PLUS = SupportedScenario(
    identifier="grid_net_plus_no_backup",
    scheme=ConnectionScheme.NET_PLUS,
    system_type="on_grid",
    backup_required=False,
    excess_export_cash_payment=True,
    source_url="https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/",
    source_reviewed_on="2026-10-04",
)

SUPPORTED_SCENARIOS = {
    scenario.scheme: scenario
    for scenario in (GRID_NET_METERING, GRID_NET_ACCOUNTING, GRID_NET_PLUS)
}


def require_supported_scenario(
    *, scheme: ConnectionScheme | str, system_type: str, backup_required: bool | None
) -> SupportedScenario:
    """Fail closed for all other schemes, system types, and unknown backup needs."""
    scenario = SUPPORTED_SCENARIOS.get(scheme)  # type: ignore[arg-type]
    if scenario is None or system_type != scenario.system_type or backup_required is not False:
        raise ValueError("Connection scenario is not supported yet")
    return scenario
