"""Quotation draft response contracts."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class QuotationDraftCreated(BaseModel):
    id: UUID
    delivery_id: UUID
    revision_id: UUID
    revision_number: int
    status: Literal["draft"]
