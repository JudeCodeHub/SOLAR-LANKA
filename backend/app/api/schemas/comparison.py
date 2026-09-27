"""Bounded panel comparison with explicit units and null unknowns."""

from typing import Self

from pydantic import BaseModel, Field, model_validator

from app.api.schemas.catalogue import ProductDetail
from app.core.value_types import EntityId

PANEL_UNITS: dict[str, str | None] = {
    "wattage_w": "W",
    "efficiency_percent": "%",
    "cell_type": None,
    "voltage_at_max_power_v": "V",
    "open_circuit_voltage_v": "V",
    "current_at_max_power_a": "A",
    "short_circuit_current_a": "A",
    "product_warranty_years": "years",
    "performance_warranty_years": "years",
    "warranty_details": None,
    "country_of_manufacture": None,
}


class PanelComparisonRequest(BaseModel):
    product_ids: list[EntityId] = Field(min_length=2, max_length=3)

    @model_validator(mode="after")
    def unique_ids(self) -> Self:
        if len(self.product_ids) != len(set(self.product_ids)):
            raise ValueError("Panels must be distinct")
        return self


class PanelComparisonResponse(BaseModel):
    items: list[ProductDetail] = Field(min_length=2, max_length=3)
    units: dict[str, str | None]
    unknown_value_label: str = "Unknown"
