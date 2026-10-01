"""Phase 7 input contract for grid-connected net metering without backup."""

from dataclasses import dataclass
from decimal import Decimal
from types import MappingProxyType
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.api.schemas.companies import District
from app.core.estimator_scenario import ConnectionScheme, require_supported_scenario
from app.core.value_types import MoneyAmount

EnergyKwh = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=3, allow_inf_nan=False)]
AreaM2 = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)]
Percentage = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]


@dataclass(frozen=True)
class InputFieldContract:
    unit: str | None
    required: bool
    displayed_default: str | None
    zero_is_value: bool = False


INPUT_CONTRACT = MappingProxyType(
    {
        "monthly_consumption_kwh": InputFieldContract("kWh/month", True, None, True),
        "district": InputFieldContract(None, True, None),
        "usable_roof_area_m2": InputFieldContract("m²", True, None, True),
        "shading_condition": InputFieldContract(None, False, "Unknown"),
        "daytime_consumption_percent": InputFieldContract("%", False, "Unknown", True),
        "monthly_bill_lkr": InputFieldContract("LKR/month", False, "Unknown", True),
        "connection_scheme": InputFieldContract(None, True, "Net metering"),
        "system_type": InputFieldContract(None, True, "On-grid"),
        "backup_required": InputFieldContract(None, True, "No backup"),
    }
)


class EstimatorInputs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    monthly_consumption_kwh: EnergyKwh
    district: District
    usable_roof_area_m2: AreaM2
    shading_condition: Literal["none", "partial", "heavy"] | None = None
    daytime_consumption_percent: Percentage | None = None
    monthly_bill_lkr: Annotated[MoneyAmount, Field(ge=0)] | None = None
    connection_scheme: ConnectionScheme
    system_type: Literal["on_grid", "off_grid", "hybrid"]
    backup_required: bool = Field(strict=True)

    @model_validator(mode="after")
    def supported_scenario(self) -> Self:
        require_supported_scenario(
            scheme=self.connection_scheme,
            system_type=self.system_type,
            backup_required=self.backup_required,
        )
        return self
