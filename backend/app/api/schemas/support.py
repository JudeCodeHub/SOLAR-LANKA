"""Support case contracts."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SupportCaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    installation_id: UUID
    product_id: UUID | None = None
    symptom: str = Field(min_length=1, max_length=2000)
    observed_code: str | None = Field(default=None, max_length=64)
    unsafe_now: bool = False

    @field_validator("symptom")
    @classmethod
    def symptom_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Describe what you see")
        return value

    @field_validator("observed_code")
    @classmethod
    def code_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class AttachmentView(BaseModel):
    asset_id: UUID
    created_at: datetime


class EquipmentView(BaseModel):
    id: UUID
    kind: Literal["panel", "inverter"]
    brand: str
    model: str


class SupportCaseView(BaseModel):
    id: UUID
    installation_id: UUID
    equipment: EquipmentView | None
    symptom: str
    observed_code: str | None
    unsafe_now: bool
    status: Literal["open", "in_progress", "resolved", "closed"]
    created_at: datetime
    attachments: list[AttachmentView]
    # Safety guidance the customer is shown straight away when they report danger.
    safety_notice: str | None


class StatusChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to: Literal["open", "in_progress", "resolved", "closed"]
    body: str | None = Field(default=None, max_length=2000)


class UpdateCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=2000)
    # Company staff and technicians choose; customers' messages are always shared.
    shared: bool = True

    @field_validator("body")
    @classmethod
    def body_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Write the update first")
        return value


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: UUID


class UpdateView(BaseModel):
    id: UUID
    kind: Literal["message", "status", "assigned", "unassigned"]
    from_status: str | None
    to_status: str | None
    body: str | None
    shared: bool
    created_at: datetime
    # The company and its technicians see who acted and in what role; the customer does not.
    actor_role: Literal["customer", "staff", "technician"] | None
    actor_id: UUID | None
    subject_id: UUID | None


class AssignedCaseSummary(BaseModel):
    """A technician's list entry: the problem, not the customer."""

    id: UUID
    equipment: EquipmentView | None
    symptom: str
    unsafe_now: bool
    status: Literal["open", "in_progress", "resolved", "closed"]
    created_at: datetime


class AssignedCase(AssignedCaseSummary):
    observed_code: str | None
    attachments: list[AttachmentView]
    updates: list[UpdateView]
