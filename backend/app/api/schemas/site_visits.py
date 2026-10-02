"""Site visit request, response and action contracts."""

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


class Reschedule(BaseModel):
    """The customer asks again with new preferred slots."""

    model_config = ConfigDict(extra="forbid")

    slots: list[SlotInput] = Field(min_length=1, max_length=MAX_SLOTS)
    note: str | None = Field(default=None, max_length=1000)


class Confirm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: UUID
    technician_id: UUID


class Propose(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slots: list[SlotInput] = Field(min_length=1, max_length=MAX_SLOTS)
    technician_id: UUID


class Accept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: UUID


class Cancel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str | None = Field(default=None, max_length=1000)


class SlotView(BaseModel):
    id: UUID
    kind: Literal["preferred", "proposed"]
    position: int
    starts_at: datetime
    ends_at: datetime


class SiteVisitView(BaseModel):
    id: UUID
    installation_id: UUID
    status: Literal["requested", "alternatives_offered", "confirmed", "cancelled", "completed"]
    timezone: str
    note: str | None
    created_at: datetime
    confirmed_starts_at: datetime | None
    confirmed_ends_at: datetime | None
    # Only company staff are told which technician; the customer sees the time.
    technician_id: UUID | None
    slots: list[SlotView]
