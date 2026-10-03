"""Educational content contracts."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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


class ArticleSummary(BaseModel):
    id: UUID
    slug: str
    title: str
    summary: str
    category_slug: str
    category_name: str
    published_at: datetime


class ArticleDetail(ArticleSummary):
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
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
