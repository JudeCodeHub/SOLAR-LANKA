"""Comparable sent-offer fields with explicit unknown scope indicators.

Amounts describe each company's own terms. They are not a ranking: a lower
quoted total may omit work or equipment included by another company. Scope
indicators must come from explicit quotation declarations. Never infer
"included" from a low/high price, a free-text line, or a missing exclusion.
"""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.core.value_types import MoneyAmount, Timestamp

InclusionStatus = Literal["included", "excluded", "not_specified"]


class ComparisonInclusions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panel_equipment: InclusionStatus = "not_specified"
    inverter_equipment: InclusionStatus = "not_specified"
    installation_labour: InclusionStatus = "not_specified"
    permits: InclusionStatus = "not_specified"
    grid_connection: InclusionStatus = "not_specified"
    monitoring: InclusionStatus = "not_specified"
    maintenance: InclusionStatus = "not_specified"

    @computed_field
    @property
    def not_specified(self) -> list[str]:
        return [name for name in type(self).model_fields if getattr(self, name) == "not_specified"]


class ComparisonEquipment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID | None
    kind: Literal["panel", "inverter"] | None
    brand: str | None
    model: str | None
    description: str
    quantity: Decimal
    line_total_lkr: MoneyAmount | None


class ComparisonOffer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quotation_id: UUID
    revision_id: UUID
    company_id: UUID
    sent_at: Timestamp
    valid_until: Timestamp
    currency: Literal["LKR"] = "LKR"
    total_lkr: MoneyAmount | None
    capacity_kwp: Decimal | None
    warranty_terms: str | None
    exclusions: str | None
    equipment: list[ComparisonEquipment]
    inclusions: ComparisonInclusions

    @computed_field
    @property
    def missing_fields(self) -> list[str]:
        return [
            name
            for name in ("total_lkr", "capacity_kwp", "warranty_terms", "exclusions")
            if getattr(self, name) is None
        ]


class OfferComparison(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: UUID
    offers: list[ComparisonOffer]
    comparison_note: str = (
        "Quoted prices may cover different work and equipment. Compare inclusions, "
        "exclusions, warranties, and validity before deciding."
    )
