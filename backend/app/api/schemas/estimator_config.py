"""Admin input for versioned estimator assumptions and their source snapshots."""

from datetime import date, datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator


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
    export: SourceSnapshot | None = None


class EstimatorConfigDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario: Literal[
        "grid_net_metering_no_backup", "grid_net_accounting_no_backup", "grid_net_plus_no_backup"
    ] = "grid_net_metering_no_backup"
    assumptions: dict[str, Any] = Field(min_length=1)
    source_metadata: SourceSnapshots

    @model_validator(mode="after")
    def export_scenarios_are_sourced(self) -> Self:
        if self.scenario != "grid_net_metering_no_backup" and (
            self.source_metadata.export is None
            or self.source_metadata.export.effective_from is None
            or "export_rate_lkr_per_kwh" not in self.assumptions
        ):
            raise ValueError("Export scenarios need a dated export source and rate")
        return self


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
    scenario: str
    assumptions: dict[str, Any]
    source_metadata: dict[str, Any]
