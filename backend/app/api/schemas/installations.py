"""Customer and company views of shared installation progress."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MilestoneProgress(BaseModel):
    position: int
    kind: str
    status: Literal["pending", "in_progress", "completed"]


class InstallationProgress(BaseModel):
    id: UUID
    accepted_revision_id: UUID
    created_at: datetime
    milestones: list[MilestoneProgress]
