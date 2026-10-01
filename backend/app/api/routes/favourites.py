"""Customer favourites are always scoped to the verified local user."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.catalogue import ProductSummary
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.core.permissions import Action, Scope, required_scopes
from app.core.value_types import EntityId
from app.db.session import get_session
from app.models.favourite import Favourite
from app.models.product import Product
from app.models.user import AppUser

router = APIRouter(prefix="/users/me/favourites", tags=["favourites"])

# Favourites are bounded so the "which products are mine?" lookup never grows without limit.
MAX_FAVOURITES = 100


class FavouriteIds(BaseModel):
    """Every published product the customer has saved, newest first, plus the allowed maximum."""

    product_ids: list[EntityId]
    max_favourites: int


def require_customer(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.FAVOURITE_MANAGE, user.role):
        raise HTTPException(403)
    return user


def _published(user: AppUser):
    """The conditions that make a favourite count: the customer's own, on a published product."""
    return (Favourite.user_id == user.id, Product.is_archived.is_(False))


@router.get("/ids", response_model=FavouriteIds)
def list_favourite_ids(
    user: Annotated[AppUser, Depends(require_customer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> FavouriteIds:
    response.headers["Cache-Control"] = "no-store"
    product_ids = session.scalars(
        select(Favourite.product_id)
        .join(Product, Product.id == Favourite.product_id)
        .where(*_published(user))
        .order_by(Favourite.created_at.desc(), Favourite.product_id.desc())
        .limit(MAX_FAVOURITES)
    ).all()
    return FavouriteIds(product_ids=list(product_ids), max_favourites=MAX_FAVOURITES)


@router.get("", response_model=PageResponse[ProductSummary])
def list_favourites(
    user: Annotated[AppUser, Depends(require_customer)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[ProductSummary]:
    scope = _published(user)
    total = (
        session.scalar(select(func.count()).select_from(Favourite).join(Product).where(*scope)) or 0
    )
    products = session.scalars(
        select(Product)
        .join(Favourite)
        .where(*scope)
        .order_by(Favourite.created_at.desc(), Favourite.product_id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    response.headers["Cache-Control"] = "no-store"
    return PageResponse[ProductSummary](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[ProductSummary.model_validate(product) for product in products],
    )


@router.put("/{product_id}", status_code=204)
def add_favourite(
    product_id: UUID,
    user: Annotated[AppUser, Depends(require_customer)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    product = session.scalars(
        select(Product).where(Product.id == product_id, Product.is_archived.is_(False))
    ).one_or_none()
    if product is None:
        raise HTTPException(404)
    # Serialise this customer's additions so two simultaneous requests cannot both slip under
    # the limit.
    session.execute(select(AppUser.id).where(AppUser.id == user.id).with_for_update())
    if session.get(Favourite, (user.id, product.id)) is None:
        saved = (
            session.scalar(
                select(func.count())
                .select_from(Favourite)
                .join(Product, Product.id == Favourite.product_id)
                .where(*_published(user))
            )
            or 0
        )
        if saved >= MAX_FAVOURITES:
            raise BusinessConflict(
                f"You can save up to {MAX_FAVOURITES} favourites. Remove one to add another."
            )
        session.add(Favourite(user_id=user.id, product_id=product.id))
    session.commit()
    return Response(status_code=204)


@router.delete("/{product_id}", status_code=204)
def remove_favourite(
    product_id: UUID,
    user: Annotated[AppUser, Depends(require_customer)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    favourite = session.get(Favourite, (user.id, product_id))
    if favourite is not None:
        session.delete(favourite)
        session.commit()
    return Response(status_code=204)
