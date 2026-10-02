"""Troubleshooting reference contracts: exact-model lookup and platform authoring."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator

SafetyLevel = Literal["safe_observation", "hazard"]


class ProductRef(BaseModel):
    id: UUID
    kind: Literal["panel", "inverter"]
    brand: str
    model: str


class ReferenceView(BaseModel):
    id: UUID
    product_id: UUID
    code: str | None
    title: str
    steps: list[str]
    safety_level: SafetyLevel
    hazard_warning: str | None
    source_title: str
    source_url: str
    source_page: str | None
    verified_on: datetime | None
    is_sample: bool


class AdminReferenceView(ReferenceView):
    status: Literal["draft", "published", "archived"]
    created_at: datetime


class Lookup(BaseModel):
    """What was found for the exact model asked about, and nothing borrowed from any other model."""

    match: Literal["exact", "none", "ambiguous"]
    product: ProductRef | None
    references: list[ReferenceView]
    # Other models with similar names: names only, never their instructions.
    suggestions: list[ProductRef]
    notice: str


class ReferenceWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    code: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    steps: list[str] = Field(min_length=1, max_length=10)
    safety_level: SafetyLevel
    hazard_warning: str | None = Field(default=None, max_length=1000)
    source_title: str = Field(min_length=1, max_length=300)
    source_url: AnyHttpUrl
    source_page: str | None = Field(default=None, max_length=64)
    verified_on: date | None = None
    is_sample: bool = True

    @field_validator("steps")
    @classmethod
    def clean_steps(cls, value: list[str]) -> list[str]:
        cleaned = [step.strip() for step in value]
        if any(not step or len(step) > 500 for step in cleaned):
            raise ValueError("Each step needs text of at most 500 characters")
        return cleaned

    @field_validator("code", "title", "hazard_warning")
    @classmethod
    def trim(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None
