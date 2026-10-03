"""Educational content contracts."""

from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.api.schemas.pagination import ListQuery

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=80)]


class ArticleListQuery(ListQuery):
    category: Slug | None = Field(default=None, description="Only articles in this category.")


class CategoryView(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None
    position: int
    # Published articles only, so the count never reveals drafts.
    article_count: int


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    publisher: str = Field(min_length=1, max_length=200)
    url: AnyHttpUrl
    accessed_on: date


class SourceView(BaseModel):
    title: str
    publisher: str
    url: str
    accessed_on: date


class ArticleSummary(BaseModel):
    id: UUID
    slug: str
    title: str
    summary: str
    category_slug: str
    category_name: str
    published_at: datetime
    # Content that depends on a rule, price or decision that can change is marked, with its date.
    time_sensitive: bool
    valid_as_of: date | None
    # True once the date it must be checked again has passed.
    review_overdue: bool
    is_sample: bool


class ArticleDetail(ArticleSummary):
    reviewed_on: date
    review_by: date | None
    sources: list[SourceView]
    body: str
    language: str
    updated_at: datetime
    related: list[ArticleSummary]


class CategoryWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: Slug
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    position: int = Field(default=0, ge=0, le=1000)


class ArticleWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: UUID
    slug: Slug
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=20_000)
    sources: list[Source] = Field(default_factory=list, max_length=10)
    time_sensitive: bool = False
    valid_as_of: date | None = None
    review_by: date | None = None
    is_sample: bool = True

    @model_validator(mode="after")
    def dated_when_time_sensitive(self) -> ArticleWrite:
        if self.time_sensitive and (
            self.valid_as_of is None or self.review_by is None or self.review_by <= self.valid_as_of
        ):
            raise ValueError(
                "Time-sensitive content needs the date it is valid for and a later review date"
            )
        return self


class AdminArticle(BaseModel):
    id: UUID
    category_id: UUID
    slug: str
    title: str
    summary: str
    body: str
    language: str
    status: Literal["draft", "published", "archived"]
    author_id: UUID
    reviewer_id: UUID | None
    reviewed_on: date | None
    sources: list[SourceView]
    time_sensitive: bool
    valid_as_of: date | None
    review_by: date | None
    is_sample: bool
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
