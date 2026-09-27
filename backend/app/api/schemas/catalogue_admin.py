"""Explicit canonical product edit fields; requests cannot set ownership or prices."""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class ProductEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand: Name | None = None
    model: Name | None = None

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set or any(
            getattr(self, key) is None for key in self.model_fields_set
        ):
            raise ValueError("Supply a non-null field to edit")
        return self


class PanelEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wattage_w: Decimal | None = Field(default=None, gt=0)
    efficiency_percent: Decimal | None = Field(default=None, gt=0, le=100)
    cell_type: Name | None = None
    voltage_at_max_power_v: Decimal | None = Field(default=None, gt=0)
    open_circuit_voltage_v: Decimal | None = Field(default=None, gt=0)
    current_at_max_power_a: Decimal | None = Field(default=None, gt=0)
    short_circuit_current_a: Decimal | None = Field(default=None, gt=0)
    product_warranty_years: Decimal | None = Field(default=None, ge=0)
    performance_warranty_years: Decimal | None = Field(default=None, ge=0)
    warranty_details: str | None = Field(default=None, max_length=2000)
    country_of_manufacture: Name | None = None

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("Supply a specification to edit")
        return self


class InverterEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Literal["on_grid", "off_grid", "hybrid"] | None = None
    capacity_kw: Decimal | None = Field(default=None, gt=0)
    mppt_count: int | None = Field(default=None, ge=0)
    warranty_years: Decimal | None = Field(default=None, ge=0)
    warranty_details: str | None = Field(default=None, max_length=2000)
    compatibility_notes: str | None = Field(default=None, max_length=4000)
    compatibility_source_url: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("Supply a specification to edit")
        return self
