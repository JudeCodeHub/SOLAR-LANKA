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


class ProductListItem(ProductSummary):
    """A list entry with the few specifications people filter on, so results show why they match.

    Panels fill `wattage_w` and `efficiency_percent`; inverters fill `category` and `capacity_kw`.
    The fields that do not apply to the kind are always null. A null that does apply means the
    value is unknown for this product, which is different from zero.
    """

    wattage_w: Decimal | None = None
    efficiency_percent: Decimal | None = None
    category: Literal["on_grid", "off_grid", "hybrid"] | None = None
    capacity_kw: Decimal | None = None


class PublicProductOffer(BaseModel):
    """A company's offer for a product, as shown to the public.

    Prices are indicative and, in the demonstration data, samples (`is_demo_price`). The company
    claim is the company's own statement, labelled as such; the platform has not verified it.
    A null price means the company gave none, which is different from a price of zero.
    """

    company_id: EntityId
    company_name: str
    indicative_price: Decimal | None
    currency: str | None
    is_demo_price: bool
    company_claim: str | None
    claim_label: Literal["company_declared"]


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
