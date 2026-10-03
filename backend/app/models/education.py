"""Educational categories and articles; drafts stay private until an administrator publishes."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base

SLUG = "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"


class EducationCategory(Base):
    __tablename__ = "education_categories"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_education_categories_slug"),
        CheckConstraint(SLUG, name="ck_education_categories_slug"),
        CheckConstraint("length(trim(name)) > 0", name="ck_education_categories_name"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Article(Base):
    __tablename__ = "articles"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_articles_slug"),
        CheckConstraint(SLUG, name="ck_articles_slug"),
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="ck_articles_status"),
        CheckConstraint("length(trim(title)) > 0", name="ck_articles_title"),
        # Published articles are complete and dated; a draft is never both published and private.
        CheckConstraint(
            "(status = 'published') = (published_at IS NOT NULL) OR status = 'archived'",
            name="ck_articles_published_at",
        ),
        CheckConstraint(
            "status <> 'published' OR (length(trim(summary)) > 0 AND length(trim(body)) > 0)",
            name="ck_articles_published_complete",
        ),
        Index("ix_articles_search", "search", postgresql_using="gin"),
        Index("ix_articles_category_status", "category_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    category_id: Mapped[UUID] = mapped_column(
        ForeignKey("education_categories.id", ondelete="RESTRICT"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    # Plain text with simple markup; the screens never render it as HTML.
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    author_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    # Title matters most, then the summary, then the text.
    search: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
            "setweight(to_tsvector('english', coalesce(summary, '')), 'B') || "
            "setweight(to_tsvector('english', coalesce(body, '')), 'C')",
            persisted=True,
        ),
    )
