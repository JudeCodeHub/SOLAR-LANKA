"""Customer-facing historical estimate contracts; private source links stay hidden."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.api.schemas.estimate_preview import EstimatePreviewResponse, PublicSource
from app.api.schemas.estimator_inputs import EstimatorInputs


class SavedEstimateSummary(BaseModel):
    id: UUID
    created_at: datetime
    scenario: str
    config_version: int
    panel_count_minimum: int
    panel_count_maximum: int
    capacity_kwp_minimum: Decimal
    capacity_kwp_maximum: Decimal


class HistoricalConfiguration(BaseModel):
    id: UUID
    scenario: str
    version: int
    published_at: datetime
    assumptions: dict[str, Any]
    sources: dict[str, PublicSource]


class SavedEstimateDetail(BaseModel):
    id: UUID
    created_at: datetime
    inputs: EstimatorInputs
    configuration: HistoricalConfiguration
    estimate: EstimatePreviewResponse
