"""Customer and company views of shared installation progress."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.installation_milestones import MilestoneStatus


class MilestoneProgress(BaseModel):
    position: int
    kind: str
    status: Literal["pending", "in_progress", "completed"]


class InstallationProgress(BaseModel):
    id: UUID
    accepted_revision_id: UUID
    created_at: datetime
    milestones: list[MilestoneProgress]


class MilestoneEvidence(BaseModel):
    kind: str
    asset_id: UUID


class MilestoneTransition(BaseModel):
    status: MilestoneStatus
    evidence: list[MilestoneEvidence] = Field(default_factory=list, max_length=8)
    reason: str | None = Field(default=None, max_length=1000)
