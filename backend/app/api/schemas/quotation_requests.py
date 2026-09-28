"""Customer quotation submission with explicit recipients and bounded requirements."""

from decimal import Decimal
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.api.schemas.companies import District

RequestDetails = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
]
EnergyKwh = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=3)]


class QuotationRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district: District
    details: RequestDetails
    monthly_consumption_kwh: EnergyKwh | None = None
    saved_estimate_id: UUID | None = None
    company_ids: list[UUID] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def unique_companies(self) -> Self:
        if len(self.company_ids) != len(set(self.company_ids)):
            raise ValueError("Select each company only once")
        return self


class RequestDeliveryCreated(BaseModel):
    id: UUID
    company_id: UUID
    status: str


class QuotationRequestCreated(BaseModel):
    id: UUID
    status: str
    deliveries: list[RequestDeliveryCreated]
