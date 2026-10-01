"""Shared value conventions for future API schemas and domain models."""

from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import (
    UUID4,
    AfterValidator,
    AwareDatetime,
    BeforeValidator,
    Field,
    PlainSerializer,
)

MONEY_PRECISION = 18
MONEY_SCALE = 2
MONEY_UNIT = Decimal("0.01")
MONEY_MAX = Decimal("9999999999999999.99")

EntityId = UUID4


def new_entity_id() -> UUID:
    return uuid4()


def deterministic_entity_id(name: str) -> UUID:
    """Stable UUID4-format identifier for reproducible seeds."""
    return UUID(bytes=sha256(name.encode()).digest()[:16], version=4)


def utc_now() -> datetime:
    return datetime.now(UTC)


def _timestamp_input(value: object) -> object:
    if not isinstance(value, (datetime, str)):
        raise ValueError("Use a timezone-aware datetime or ISO 8601 timestamp with an offset")
    # Pydantic otherwise accepts numeric strings as Unix timestamps.
    if isinstance(value, str) and "T" not in value and "t" not in value:
        raise ValueError("Use an ISO 8601 timestamp with a time and timezone offset")
    return value


def _money_input(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (Decimal, str, int)):
        raise ValueError("Use Decimal, a decimal string, or an integer; floats are not accepted")
    return value


Timestamp = Annotated[
    AwareDatetime,
    BeforeValidator(_timestamp_input),
    AfterValidator(lambda value: value.astimezone(UTC)),
]
MoneyAmount = Annotated[
    Decimal,
    BeforeValidator(_money_input),
    Field(
        max_digits=MONEY_PRECISION,
        decimal_places=MONEY_SCALE,
        allow_inf_nan=False,
        ge=-MONEY_MAX,
        le=MONEY_MAX,
    ),
    AfterValidator(lambda value: value.quantize(MONEY_UNIT)),
    PlainSerializer(lambda value: format(value, ".2f"), return_type=str, when_used="json"),
]
