from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid1

import pytest
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from app.core.value_types import EntityId, MoneyAmount, Timestamp, new_entity_id, utc_now


class ExampleRecord(BaseModel):
    id: EntityId = Field(default_factory=new_entity_id)
    created_at: Timestamp = Field(default_factory=utc_now)
    amount: MoneyAmount | None = None


def test_identifiers_are_uuid4_and_serialize_as_strings() -> None:
    record = ExampleRecord()
    assert record.id.version == 4
    assert record.model_dump(mode="json")["id"] == str(record.id)
    with pytest.raises(ValidationError):
        ExampleRecord(id=uuid1())


def test_offset_timestamp_is_normalised_to_utc() -> None:
    record = ExampleRecord(created_at="2026-09-22T10:30:00+05:30")
    assert record.created_at == datetime(2026, 9, 22, 5, 0, tzinfo=UTC)
    assert record.model_dump(mode="json")["created_at"] == "2026-09-22T05:00:00Z"
    assert utc_now().tzinfo is UTC


@pytest.mark.parametrize("value", ["2026-09-22T10:30:00", datetime(2026, 9, 22), 0, "0", None])
def test_naive_or_ambiguous_timestamp_is_rejected(value: object) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(Timestamp).validate_python(value)


def test_null_zero_and_omitted_amounts_remain_distinct() -> None:
    omitted = ExampleRecord()
    unknown = ExampleRecord(amount=None)
    zero = ExampleRecord(amount="0")
    assert omitted.model_dump(exclude_unset=True) == {}
    assert unknown.model_dump(exclude_unset=True, mode="json") == {"amount": None}
    assert zero.model_dump(exclude_unset=True, mode="json") == {"amount": "0.00"}
    assert zero.amount == Decimal("0.00")


def test_decimal_arithmetic_and_json_round_trip_preserve_precision() -> None:
    record = ExampleRecord(amount=Decimal("0.10") + Decimal("0.20"))
    assert record.amount == Decimal("0.30")
    assert record.model_dump(mode="json")["amount"] == "0.30"
    assert ExampleRecord.model_validate_json(record.model_dump_json()).amount == record.amount


@pytest.mark.parametrize("value", [0.1, True, "", "NaN", "Infinity", "1.001", "10000000000000000"])
def test_invalid_or_excess_precision_money_is_rejected(value: object) -> None:
    with pytest.raises(ValidationError):
        TypeAdapter(MoneyAmount).validate_python(value)


def test_negative_adjustments_and_maximum_amount_are_preserved() -> None:
    adapter = TypeAdapter(MoneyAmount)
    assert adapter.validate_python("-10.25") == Decimal("-10.25")
    assert adapter.validate_python("9999999999999999.99") == Decimal("9999999999999999.99")
