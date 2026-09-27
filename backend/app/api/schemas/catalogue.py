"""Public catalogue responses with stable product UUIDs and explicit specification units."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.api.schemas.public_media import PublicMedia
from app.core.value_types import EntityId, Timestamp


class ProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    kind: Literal["panel", "inverter"]
    brand: str
    model: str
    media: list[PublicMedia] = Field(default_factory=list)


class PanelSpecifications(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    wattage_w: Decimal | None
    efficiency_percent: Decimal | None
    cell_type: str | None
    voltage_at_max_power_v: Decimal | None
    open_circuit_voltage_v: Decimal | None
    current_at_max_power_a: Decimal | None
    short_circuit_current_a: Decimal | None
    product_warranty_years: Decimal | None
    performance_warranty_years: Decimal | None
    warranty_details: str | None
    country_of_manufacture: str | None


class InverterSpecifications(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: Literal["on_grid", "off_grid", "hybrid"] | None
    capacity_kw: Decimal | None
    mppt_count: int | None
    connectivity: list[str] | None
    warranty_years: Decimal | None
    warranty_details: str | None
    compatibility_notes: str | None
    compatibility_source_url: str | None
    manual_urls: list[str] | None
    manufacturer_document_urls: list[str] | None
    error_code_reference_urls: list[str] | None


class ProductDetail(ProductSummary):
    image_urls: list[str] | None
    datasheet_urls: list[str] | None
    source_url: str | None
    verified_at: Timestamp | None
    created_at: Timestamp
    specifications: PanelSpecifications | InverterSpecifications
