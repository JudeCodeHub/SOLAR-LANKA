"""Scoped customer progress and company inbox response shapes."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


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
