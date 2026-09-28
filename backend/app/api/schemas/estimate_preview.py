"""Public, unsaved estimator output with explicit units and missing values."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DecimalRange(BaseModel):
    minimum: Decimal
    maximum: Decimal


class IntegerRange(BaseModel):
    minimum: int
    maximum: int


class SizingPreview(BaseModel):
    panel_count: IntegerRange
    roof_panel_capacity: int
    capacity_kwp: DecimalRange
    installed_area_m2: DecimalRange
    annual_generation_kwh: DecimalRange | None
    average_monthly_generation_kwh: DecimalRange | None


class FinancialPreview(BaseModel):
    installed_cost_lkr: DecimalRange | None
    baseline_monthly_bill_lkr: Decimal | None
    monthly_savings_lkr: DecimalRange | None
    annual_savings_lkr: DecimalRange | None
    simple_payback_years: DecimalRange | None


class PublicSource(BaseModel):
    model_config = ConfigDict(extra="ignore")

    publisher: str | None = None
    title: str | None = None
    unit: str | None = None
    reviewed_on: date | None = None
    effective_from: date | None = None
    limitation: str | None = None
    url: str | None = None


class EstimatePreviewResponse(BaseModel):
    scenario: str
    config_id: UUID
    config_version: int
    sizing: SizingPreview
    financial: FinancialPreview
    sources: dict[str, PublicSource]
    disclaimer: str
