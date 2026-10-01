"""Validated editable terms for one quotation draft."""

from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.core.quotation_terms import round_lkr
from app.core.value_types import MoneyAmount


def exact_decimal(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (Decimal, str, int)):
        raise ValueError("Use a decimal string or integer, not a float.")
    return value


class DraftLineInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["equipment", "charge"]
    product_id: UUID | None = None
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]
    quantity: Annotated[
        Decimal,
        BeforeValidator(exact_decimal),
        Field(gt=0, max_digits=12, decimal_places=3),
    ]
    unit_price: Annotated[MoneyAmount, Field(ge=0)]

    @model_validator(mode="after")
    def equipment_reference(self):
        if (self.kind == "equipment") != (self.product_id is not None):
            raise ValueError("Equipment requires a product; charges cannot reference one.")
        return self


class DraftTermsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lines: Annotated[list[DraftLineInput], Field(min_length=1, max_length=50)]
    discount_kind: Literal["none", "fixed", "percent"] = "none"
    discount_value: Annotated[MoneyAmount, Field(ge=0)] = Decimal("0.00")
    tax_rate_percent: Annotated[MoneyAmount, Field(ge=0, le=100)] = Decimal("0.00")
    capacity_kwp: (
        Annotated[
            Decimal, BeforeValidator(exact_decimal), Field(gt=0, max_digits=10, decimal_places=3)
        ]
        | None
    ) = None
    warranty_terms: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
        | None
    ) = None
    exclusions: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
        | None
    ) = None
    validity_days: Annotated[int, Field(strict=True, ge=1, le=90)] | None = None
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None = None

    @model_validator(mode="after")
    def valid_discount(self):
        if self.discount_kind == "none" and self.discount_value != 0:
            raise ValueError("A zero discount is required when discount_kind is none.")
        if self.discount_kind == "percent" and self.discount_value > 100:
            raise ValueError("Percentage discount cannot exceed 100.")
        if self.discount_kind == "fixed":
            subtotal = sum(
                (round_lkr(line.quantity * line.unit_price) for line in self.lines),
                start=Decimal("0.00"),
            )
            if self.discount_value > subtotal:
                raise ValueError("Fixed discount cannot exceed the line subtotal.")
        return self


class DraftTermsSaved(BaseModel):
    quotation_id: UUID
    revision_id: UUID
    line_count: int
    subtotal: MoneyAmount
    discount: MoneyAmount
    tax: MoneyAmount
    total: MoneyAmount
    status: Literal["draft"]


class DraftLineView(BaseModel):
    position: int
    kind: Literal["equipment", "charge"]
    product_id: UUID | None
    description: str
    quantity: str
    unit_price: str
    # Calculated by the server when the draft is saved; never supplied by the client.
    line_total: str | None


class DraftTermsView(BaseModel):
    """The editable terms of one revision exactly as stored, so a draft can be reopened."""

    lines: list[DraftLineView]
    discount_kind: Literal["none", "fixed", "percent"]
    discount_value: str
    tax_rate_percent: str
    capacity_kwp: str | None
    warranty_terms: str | None
    exclusions: str | None
    validity_days: int | None
    notes: str | None
    subtotal: str | None
    discount: str | None
    tax: str | None
    total: str | None


class CurrentQuotation(BaseModel):
    quotation_id: UUID
    revision_id: UUID
    revision_number: int
    status: Literal["draft", "sent", "revised", "accepted", "declined", "expired", "withdrawn"]
    terms: DraftTermsView


class SentOfferRequired(BaseModel):
    """Validate required fields before a later send operation freezes a revision."""

    model_config = ConfigDict(from_attributes=True)

    capacity_kwp: Annotated[Decimal, Field(gt=0, max_digits=10, decimal_places=3)]
    warranty_terms: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    exclusions: Annotated[str, StringConstraints(min_length=1, max_length=2000)]
    validity_days: Annotated[int, Field(ge=1, le=90)]
