"""Shared list contracts; endpoint-specific filters must use explicit typed fields.

Apply validated limit/offset and filters in the database query, not after fetching
all rows. Each endpoint must use a stable ordering with a unique tie-breaker.
Never pass client-supplied filter names directly into SQL.
"""

from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_OFFSET = 10_000
MAX_SEARCH_LENGTH = 100


class PaginationParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    limit: int = Field(
        default=DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Records per page: default 20, minimum 1, maximum 100.",
    )
    offset: int = Field(
        default=0,
        ge=0,
        le=MAX_OFFSET,
        description="Records to skip: default 0, maximum 10000. Narrow filters beyond this limit.",
    )


class ListQuery(PaginationParams):
    search: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_SEARCH_LENGTH)]
        | None
    ) = Field(
        default=None,
        description="Optional search: at most 100 trimmed characters; blank means no filter.",
    )

    @field_validator("search")
    @classmethod
    def blank_search_is_absent(cls, value: str | None) -> str | None:
        return value or None


class PageResponse[T](PaginationParams):
    items: list[T] = Field(max_length=MAX_PAGE_SIZE)
    total: int = Field(
        ge=0, description="Total matching records before pagination, including filters."
    )

    @model_validator(mode="after")
    def validate_page_size(self) -> Self:
        if len(self.items) > self.limit:
            raise ValueError("Returned items exceed the requested page size")
        if self.items and self.offset + len(self.items) > self.total:
            raise ValueError("Returned items exceed the matching total at this offset")
        return self
