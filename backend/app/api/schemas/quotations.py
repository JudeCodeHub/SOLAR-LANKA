"""Quotation draft response contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class QuotationDraftCreated(BaseModel):
    id: UUID
    delivery_id: UUID
    revision_id: UUID
    revision_number: int
    status: Literal["draft"]


class SentQuotationLine(BaseModel):
    position: int
    kind: Literal["equipment", "charge"]
    product_id: UUID | None
    product_snapshot: dict[str, str] | None
    description: str
    quantity: str
    unit_price: str
    line_total: str | None


class QuotationSent(BaseModel):
    id: UUID
    revision_id: UUID
    revision_number: int
    status: Literal["sent"]
    sent_at: datetime
    valid_until: datetime
    capacity_kwp: str
    warranty_terms: str
    exclusions: str
    notes: str | None
    subtotal: str
    discount: str
    tax: str
    total: str
    lines: list[SentQuotationLine]


class QuotationRevisionView(BaseModel):
    id: UUID
    quotation_id: UUID
    revision_number: int
    status: Literal["draft", "sent", "revised", "accepted", "declined", "expired", "withdrawn"]
    created_at: datetime
    sent_at: datetime | None
    valid_until: datetime | None
    capacity_kwp: str | None
    warranty_terms: str | None
    exclusions: str | None
    notes: str | None
    subtotal: str | None
    discount: str | None
    tax: str | None
    total: str | None
    lines: list[SentQuotationLine]
