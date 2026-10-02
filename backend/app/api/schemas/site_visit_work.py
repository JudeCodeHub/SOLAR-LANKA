"""What a technician and company staff see while doing and finishing a visit."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CompleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=2000)


class NoteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=2000)


class NoteView(BaseModel):
    id: UUID
    actor_id: UUID
    body: str
    created_at: datetime


class EvidenceView(BaseModel):
    asset_id: UUID
    actor_id: UUID
    created_at: datetime


class HistoryEntry(BaseModel):
    action: str
    from_status: str | None
    to_status: str
    reason: str | None
    created_at: datetime
    # Company staff and the technician see who acted; the customer does not.
    actor_id: UUID | None


class VisitWork(BaseModel):
    id: UUID
    installation_id: UUID
    district: str | None
    status: Literal["requested", "alternatives_offered", "confirmed", "cancelled", "completed"]
    timezone: str
    customer_note: str | None
    confirmed_starts_at: datetime | None
    confirmed_ends_at: datetime | None
    completed_at: datetime | None
    completed_by: UUID | None
    completion_summary: str | None
    notes: list[NoteView]
    evidence: list[EvidenceView]
    history: list[HistoryEntry]


class MyVisit(BaseModel):
    """A technician's list entry: when, where (district only) and how it stands."""

    id: UUID
    installation_id: UUID
    district: str | None
    status: str
    confirmed_starts_at: datetime | None
    confirmed_ends_at: datetime | None
