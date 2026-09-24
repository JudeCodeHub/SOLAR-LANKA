import pytest
from pydantic import ValidationError

from app.api.schemas.pagination import ListQuery, PageResponse


def test_defaults_and_filter_normalisation() -> None:
    query = ListQuery()
    assert (query.limit, query.offset, query.search) == (20, 0, None)
    assert ListQuery(search="  solar  ").search == "solar"
    assert ListQuery(search="   ").search is None
    assert ListQuery(limit="100", offset="10000").limit == 100


@pytest.mark.parametrize(
    "values",
    [
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
        {"offset": 10001},
        {"search": "x" * 101},
        {"unsupported_filter": "value"},
    ],
)
def test_invalid_limits_and_unknown_filters_are_rejected(values: dict) -> None:
    with pytest.raises(ValidationError):
        ListQuery(**values)


def test_bounds_and_defaults_are_in_generated_schema() -> None:
    fields = ListQuery.model_json_schema()["properties"]
    assert fields["limit"]["default"] == 20
    assert fields["limit"]["maximum"] == 100
    assert fields["offset"]["default"] == 0
    assert fields["offset"]["maximum"] == 10000
    assert fields["search"]["anyOf"][0]["maxLength"] == 100
    assert all(fields[name]["description"] for name in ("limit", "offset", "search"))


def test_page_preserves_filtered_total_and_allows_empty_late_page() -> None:
    page = PageResponse[str](items=["panel"], total=21, limit=20, offset=20)
    assert page.model_dump()["total"] == 21
    assert PageResponse[str](items=[], total=0, offset=20).items == []


@pytest.mark.parametrize(
    "values",
    [
        {"items": [1, 2], "limit": 1, "total": 2},
        {"items": [1], "offset": 2, "total": 2},
        {"items": [], "total": -1},
    ],
)
def test_inconsistent_page_responses_are_rejected(values: dict) -> None:
    with pytest.raises(ValidationError):
        PageResponse[int](**values)
