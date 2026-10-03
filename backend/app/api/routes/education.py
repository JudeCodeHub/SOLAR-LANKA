"""Educational content: public published articles with search, and administrator authoring."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.education import (
    AdminArticle,
    ArticleDetail,
    ArticleListQuery,
    ArticleSummary,
    ArticleWrite,
    CategoryView,
    CategoryWrite,
)
from app.api.schemas.pagination import PageResponse
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.education import Article, EducationCategory
from app.models.user import AppUser

public_router = APIRouter(prefix="/education", tags=["education"])
admin_router = APIRouter(prefix="/admin/education", tags=["education administration"])

RELATED = 3


def require_editor(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.CONTENT_MANAGE, user.role):
        raise HTTPException(403)
    return user


def _summary(article: Article, category: EducationCategory) -> ArticleSummary:
    assert article.published_at is not None
    return ArticleSummary(
        id=article.id,
        slug=article.slug,
        title=article.title,
        summary=article.summary,
        category_slug=category.slug,
        category_name=category.name,
        published_at=article.published_at,
    )


# ---- public: published content only ----


@public_router.get("/categories", response_model=list[CategoryView])
def list_categories(
    session: Annotated[Session, Depends(get_session)], response: Response
) -> list[CategoryView]:
    response.headers["Cache-Control"] = "no-store"
    counts = dict(
        session.execute(
            select(Article.category_id, func.count())
            .where(Article.status == "published")
            .group_by(Article.category_id)
        ).all()
    )
    rows = session.scalars(
        select(EducationCategory).order_by(EducationCategory.position, EducationCategory.name)
    ).all()
    return [
        CategoryView(
            id=c.id,
            slug=c.slug,
            name=c.name,
            description=c.description,
            position=c.position,
            article_count=counts.get(c.id, 0),
        )
        for c in rows
    ]


@public_router.get("/articles", response_model=PageResponse[ArticleSummary])
def list_articles(
    session: Annotated[Session, Depends(get_session)],
    query: Annotated[ArticleListQuery, Query()],
    response: Response,
) -> PageResponse[ArticleSummary]:
    """Published articles, newest first; a search ranks title matches above text matches."""
    response.headers["Cache-Control"] = "no-store"
    conditions = [Article.status == "published"]
    order = [Article.published_at.desc(), Article.id]
    if query.category is not None:
        conditions.append(EducationCategory.slug == query.category)
    if query.search is not None:
        terms = func.websearch_to_tsquery("english", query.search)
        conditions.append(Article.search.op("@@")(terms))
        order = [func.ts_rank(Article.search, terms).desc(), *order]
    base = (
        select(Article, EducationCategory)
        .join(EducationCategory, Article.category_id == EducationCategory.id)
        .where(*conditions)
    )
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = session.execute(base.order_by(*order).limit(query.limit).offset(query.offset)).all()
    return PageResponse[ArticleSummary](
        items=[_summary(article, category) for article, category in rows],
        total=total,
        limit=query.limit,
        offset=query.offset,
    )


@public_router.get("/articles/{slug}", response_model=ArticleDetail)
def read_article(
    slug: str, session: Annotated[Session, Depends(get_session)], response: Response
) -> ArticleDetail:
    response.headers["Cache-Control"] = "no-store"
    row = session.execute(
        select(Article, EducationCategory)
        .join(EducationCategory, Article.category_id == EducationCategory.id)
        .where(Article.slug == slug, Article.status == "published")
    ).one_or_none()
    if row is None:
        # A draft, an archived article and one that never existed look the same.
        raise HTTPException(404)
    article, category = row
    others = session.scalars(
        select(Article)
        .where(
            Article.category_id == article.category_id,
            Article.status == "published",
            Article.id != article.id,
        )
        .order_by(Article.published_at.desc(), Article.id)
        .limit(RELATED)
    ).all()
    summary = _summary(article, category)
    return ArticleDetail(
        **summary.model_dump(),
        body=article.body,
        language=article.language,
        updated_at=article.updated_at,
        related=[_summary(other, category) for other in others],
    )


# ---- platform administrators ----


def _admin(article: Article) -> AdminArticle:
    return AdminArticle.model_validate(article, from_attributes=True)


def _locked(session: Session, article_id: UUID) -> Article:
    article = session.scalars(
        select(Article).where(Article.id == article_id).with_for_update()
    ).one_or_none()
    if article is None:
        raise HTTPException(404)
    return article


def _category(session: Session, category_id: UUID) -> EducationCategory:
    category = session.get(EducationCategory, category_id)
    if category is None:
        raise HTTPException(404)
    return category


def _save(session: Session, what: str) -> None:
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise BusinessConflict(f"Another {what} already uses that address.") from None


@admin_router.post("/categories", response_model=CategoryView, status_code=201)
def create_category(
    body: CategoryWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> CategoryView:
    category = EducationCategory(**body.model_dump())
    session.add(category)
    _save(session, "category")
    view = CategoryView(**body.model_dump(), id=category.id, article_count=0)
    session.commit()
    return view


@admin_router.put("/categories/{category_id}", response_model=CategoryView)
def edit_category(
    category_id: UUID,
    body: CategoryWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> CategoryView:
    category = _category(session, category_id)
    for field, value in body.model_dump().items():
        setattr(category, field, value)
    _save(session, "category")
    count = session.scalar(
        select(func.count())
        .select_from(Article)
        .where(Article.category_id == category.id, Article.status == "published")
    )
    view = CategoryView(**body.model_dump(), id=category.id, article_count=count or 0)
    session.commit()
    return view


@admin_router.get("/articles", response_model=list[AdminArticle])
def admin_articles(
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    status: str | None = None,
) -> list[AdminArticle]:
    response.headers["Cache-Control"] = "no-store"
    statement = select(Article).order_by(Article.updated_at.desc(), Article.id).limit(200)
    if status in {"draft", "published", "archived"}:
        statement = statement.where(Article.status == status)
    return [_admin(a) for a in session.scalars(statement)]


@admin_router.get("/articles/{article_id}", response_model=AdminArticle)
def admin_article(
    article_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AdminArticle:
    response.headers["Cache-Control"] = "no-store"
    article = session.get(Article, article_id)
    if article is None:
        raise HTTPException(404)
    return _admin(article)


@admin_router.post("/articles", response_model=AdminArticle, status_code=201)
def create_article(
    body: ArticleWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminArticle:
    _category(session, body.category_id)
    article = Article(author_id=editor.id, status="draft", **body.model_dump())
    session.add(article)
    _save(session, "article")
    view = _admin(article)
    session.commit()
    return view


@admin_router.put("/articles/{article_id}", response_model=AdminArticle)
def edit_article(
    article_id: UUID,
    body: ArticleWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminArticle:
    article = _locked(session, article_id)
    if article.status != "draft":
        raise BusinessConflict("Only a draft can be edited. Move it back to a draft first.")
    _category(session, body.category_id)
    for field, value in body.model_dump().items():
        setattr(article, field, value)
    _save(session, "article")
    view = _admin(article)
    session.commit()
    return view


def _move(session: Session, article_id: UUID, allowed: set[str], target: str) -> AdminArticle:
    article = _locked(session, article_id)
    if article.status not in allowed:
        raise BusinessConflict(f"A {article.status} article cannot move to {target}.")
    if target == "published":
        if not article.summary.strip() or not article.body.strip():
            raise BusinessConflict("Write a summary and the article text before publishing.")
        article.published_at = datetime.now(UTC)
    elif target in {"draft", "archived"}:
        article.published_at = None
    article.status = target
    session.flush()
    view = _admin(article)
    session.commit()
    return view


@admin_router.post("/articles/{article_id}/publish", response_model=AdminArticle)
def publish(
    article_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminArticle:
    return _move(session, article_id, {"draft"}, "published")


@admin_router.post("/articles/{article_id}/unpublish", response_model=AdminArticle)
def unpublish(
    article_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminArticle:
    return _move(session, article_id, {"published", "archived"}, "draft")


@admin_router.post("/articles/{article_id}/archive", response_model=AdminArticle)
def archive(
    article_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminArticle:
    return _move(session, article_id, {"draft", "published"}, "archived")
