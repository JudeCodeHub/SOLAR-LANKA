"""Company offer input and output; canonical product fields are excluded."""

from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.value_types import EntityId, Timestamp

Currency = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")]


class OfferFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    indicative_price: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    currency: Currency | None = None
    is_demo_price: bool | None = None
    company_claim: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def price_pair(self) -> Self:
        if "indicative_price" in self.model_fields_set or "currency" in self.model_fields_set:
            if (self.indicative_price is None) != (self.currency is None):
                raise ValueError("Price and currency must be supplied together or both cleared")
        if "is_demo_price" in self.model_fields_set and self.is_demo_price is None:
            raise ValueError("Demo-price label cannot be null")
        return self


class OfferCreate(OfferFields):
    product_id: EntityId


class OfferUpdate(OfferFields):
    @model_validator(mode="after")
    def nonempty(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Supply at least one offer field")
        return self


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    company_id: EntityId
    product_id: EntityId
    indicative_price: Decimal | None
    currency: str | None
    is_demo_price: bool
    company_claim: str | None
    claim_label: str
    created_at: Timestamp
