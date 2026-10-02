"""Admin input for versioned estimator assumptions and their source snapshots."""

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class SourceSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    publisher: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=300)
    url: AnyHttpUrl
    unit: str = Field(min_length=1, max_length=80)
    reviewed_on: date
    effective_from: date | None = None
    limitation: str = Field(min_length=1, max_length=1000)
    basis: Literal["installer_quote"] | None = None


class SourceSnapshots(BaseModel):
    model_config = ConfigDict(extra="forbid")

    yield_source: SourceSnapshot = Field(alias="yield")
    tariff: SourceSnapshot
    cost: SourceSnapshot


class EstimatorConfigDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assumptions: dict[str, Any] = Field(min_length=1)
    source_metadata: SourceSnapshots


class EstimatorConfigSummary(BaseModel):
    """One stored version of the estimator assumptions, without their content."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version: int
    status: Literal["draft", "published"]
    is_archived: bool
    created_at: datetime
    published_at: datetime | None


class EstimatorConfigDetail(EstimatorConfigSummary):
    assumptions: dict[str, Any]
    source_metadata: dict[str, Any]
