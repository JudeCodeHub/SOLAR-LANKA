"""Customer and company views of shared installation progress."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.installation_milestones import MilestoneStatus


class MilestoneEvidence(BaseModel):
    kind: str
    asset_id: UUID


class MilestoneProgress(BaseModel):
    position: int
    kind: str
    status: Literal["pending", "in_progress", "completed"]
    evidence: list[MilestoneEvidence] = Field(default_factory=list)


class MilestoneHistory(BaseModel):
    id: UUID
    milestone_id: UUID
    actor_id: UUID
    from_status: MilestoneStatus
    to_status: MilestoneStatus
    reason: str | None
    delay_until: datetime | None
    next_action: str | None
    created_at: datetime


class InstallationProgress(BaseModel):
    id: UUID
    accepted_revision_id: UUID
    created_at: datetime
    milestones: list[MilestoneProgress]
    history: list[MilestoneHistory]


class MilestoneTransition(BaseModel):
    status: MilestoneStatus
    evidence: list[MilestoneEvidence] = Field(default_factory=list, max_length=8)
    reason: str | None = Field(default=None, max_length=1000)
    delay_until: datetime | None = None
    next_action: str | None = Field(default=None, max_length=1000)

    @field_validator("delay_until")
    @classmethod
    def timezone_required(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Delay must include a timezone")
        return value


class MilestoneScheduleUpdate(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)
    delay_until: datetime | None = None
    next_action: str | None = Field(default=None, max_length=1000)

    @field_validator("delay_until")
    @classmethod
    def timezone_required(cls, value: datetime | None) -> datetime | None:
        return MilestoneTransition.timezone_required(value)


class InternalNoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def require_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Note text is required")
        return value


class InternalNoteView(BaseModel):
    id: UUID
    installation_id: UUID
    actor_id: UUID
    body: str
    created_at: datetime
