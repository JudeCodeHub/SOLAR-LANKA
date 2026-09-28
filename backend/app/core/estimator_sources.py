"""Reviewed references for the grid net-metering estimator (2026-09-28).

References are not calculation inputs. Yield needs a location-specific extract,
tariffs need transcribed rate bands, and costs need a dated installed-system quote
before any financial result can be published. No value below is a guarantee.
"""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class EstimatorSource:
    topic: str
    publisher: str
    title: str
    url: str
    unit: str
    reviewed_on: date
    effective_from: date | None = None
    dataset_metadata_updated_on: date | None = None
    value: float | None = None
    limitation: str = ""


YIELD_SOURCE = EstimatorSource(
    topic="yield",
    publisher="World Bank / Global Solar Atlas",
    title="World - Photovoltaic Power Potential (PVOUT) GIS Data",
    url="https://datacatalog.worldbank.org/search/dataset/0038641/world-photovoltaic-power-potential-pvout-gis-data-global-solar-atlas",
    unit="kWh/kWp",
    reviewed_on=date(2026, 9, 28),
    dataset_metadata_updated_on=date(2023, 1, 24),
    limitation=(
        "Long-term potential for a reference PV system; "
        "no district or roof-specific yield loaded."
    ),
)

TARIFF_SOURCE = EstimatorSource(
    topic="tariff",
    publisher="Public Utilities Commission of Sri Lanka",
    title="Decision on Electricity Tariff - May 2026, Annex 2",
    url="https://www.pucsl.gov.lk/wp-content/uploads/2026/05/Full-Final_Decision-on-Electricity-Tariffs-May-2026.pdf",
    unit="LKR/kWh (energy); LKR/month (fixed charge)",
    reviewed_on=date(2026, 9, 28),
    effective_from=date(2026, 5, 11),
    limitation=(
        "Applies until the next revision; rate bands are not configured yet "
        "and must be rechecked."
    ),
)

COST_SOURCE = EstimatorSource(
    topic="cost",
    publisher="Sri Lanka Sustainable Energy Authority",
    title="Sooriyabala Sangaramaya - registered solar PV service providers",
    url="https://www.energy.gov.lk/en/soorya-bala-sangramaya",
    unit="LKR per installed system",
    reviewed_on=date(2026, 9, 28),
    limitation="Provider directory, not a price source; require a dated, scoped installer quote.",
)

ESTIMATOR_SOURCES = (YIELD_SOURCE, TARIFF_SOURCE, COST_SOURCE)
