"""Scoped customer progress and company inbox response shapes."""

from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints


class DeliveryProgress(BaseModel):
    id: UUID
    company_id: UUID
    status: str
    created_at: datetime
    viewed_at: datetime | None


class CustomerRequestSummary(BaseModel):
    id: UUID
    status: str
    created_at: datetime
    deliveries: list[DeliveryProgress]


class CustomerRequestDetail(CustomerRequestSummary):
    requirements: dict[str, Any]
    saved_estimate_id: UUID | None


class CompanyInboxItem(BaseModel):
    id: UUID
    request_id: UUID
    status: str
    created_at: datetime
    district: str


class CompanyDeliveryDetail(CompanyInboxItem):
    viewed_at: datetime | None
    requirements: dict[str, Any]


class DeliveryProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["viewed", "responding"]


class CompanyNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class CompanyNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_id: UUID
    author_id: UUID
    body: str
    created_at: datetime


class RequestStatusResponse(BaseModel):
    id: UUID
    status: Literal["cancelled"]


class DeliveryClosureResponse(BaseModel):
    id: UUID
    status: Literal["closed"]
    request_status: Literal["submitted", "closed"]
