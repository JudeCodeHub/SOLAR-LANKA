"""Assignment inputs and the deliberately minimal view a technician gets of a job."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID


class AssignmentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    technician_id: UUID
    assigned_by: UUID
    created_at: datetime


class JobStep(BaseModel):
    position: int
    kind: str
    status: Literal["pending", "in_progress", "completed"]


class AssignedJobSummary(BaseModel):
    """What a technician sees in their list: no customer, no price, no notes."""

    id: UUID
    company_id: UUID
    district: str | None
    created_at: datetime
    completed_steps: int
    total_steps: int


class AssignedJob(AssignedJobSummary):
    steps: list[JobStep]


class TechnicianView(BaseModel):
    """The accounts keep no names, so a technician is identified by their account id."""

    user_id: UUID
