"""Phase 7 estimator boundary: one grid-connected net-metering scenario.

PUCSL describes net metering as billing for net imported energy and banking
excess generation, without cash payment for excess exports. Source reviewed on
2026-09-28: https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/

Net Accounting, Net Plus, Net Plus Plus, off-grid, hybrid, and battery-backup
calculations are deferred. Their financial rules must not reuse this scenario.
Tariff, yield, and cost values require separate dated configuration; this file
provides no tariff or generation guarantee.
"""

from dataclasses import dataclass
from enum import StrEnum


class ConnectionScheme(StrEnum):
    NET_METERING = "net_metering"
    NET_ACCOUNTING = "net_accounting"
    NET_PLUS = "net_plus"
    NET_PLUS_PLUS = "net_plus_plus"


DEFERRED_SCHEMES = frozenset(
    {ConnectionScheme.NET_ACCOUNTING, ConnectionScheme.NET_PLUS, ConnectionScheme.NET_PLUS_PLUS}
)
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


def require_supported_scenario(
    *, scheme: ConnectionScheme | str, system_type: str, backup_required: bool | None
) -> SupportedScenario:
    """Fail closed for all other schemes, system types, and unknown backup needs."""
    if (
        scheme != GRID_NET_METERING.scheme
        or system_type != GRID_NET_METERING.system_type
        or backup_required is not False
    ):
        raise ValueError("Connection scenario is not supported yet")
    return GRID_NET_METERING
