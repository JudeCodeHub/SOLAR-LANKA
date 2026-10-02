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
