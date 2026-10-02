"""Site visit request and read contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.site_visit_rules import DEFAULT_TIMEZONE, MAX_SLOTS


class SlotInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: datetime
    ends_at: datetime


class SiteVisitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timezone: str = Field(default=DEFAULT_TIMEZONE, max_length=64)
    slots: list[SlotInput] = Field(min_length=1, max_length=MAX_SLOTS)
    note: str | None = Field(default=None, max_length=1000)


class SlotView(BaseModel):
    position: int
    starts_at: datetime
    ends_at: datetime


class SiteVisitView(BaseModel):
    id: UUID
    installation_id: UUID
    status: Literal["requested", "confirmed", "cancelled", "completed"]
    timezone: str
    note: str | None
    created_at: datetime
    slots: list[SlotView]
