"""Bounded, typed catalogue search and specification filters."""

from decimal import Decimal
from typing import Literal, Self

from pydantic import Field, model_validator

from app.api.schemas.pagination import ListQuery


class PanelQuery(ListQuery):
    min_wattage_w: Decimal | None = Field(default=None, gt=0)
    max_wattage_w: Decimal | None = Field(default=None, gt=0)
    min_efficiency_percent: Decimal | None = Field(default=None, gt=0, le=100)

    @model_validator(mode="after")
    def check_range(self) -> Self:
        if (
            self.min_wattage_w is not None
            and self.max_wattage_w is not None
            and self.min_wattage_w > self.max_wattage_w
        ):
            raise ValueError("Minimum wattage exceeds maximum")
        return self


class InverterQuery(ListQuery):
    category: Literal["on_grid", "off_grid", "hybrid"] | None = None
    min_capacity_kw: Decimal | None = Field(default=None, gt=0)
    max_capacity_kw: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def check_range(self) -> Self:
        if (
            self.min_capacity_kw is not None
            and self.max_capacity_kw is not None
            and self.min_capacity_kw > self.max_capacity_kw
        ):
            raise ValueError("Minimum capacity exceeds maximum")
        return self
