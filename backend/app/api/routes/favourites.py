"""Customer favourites are always scoped to the verified local user."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.catalogue import ProductSummary
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.favourite import Favourite
from app.models.product import Product
from app.models.user import AppUser

router = APIRouter(prefix="/users/me/favourites", tags=["favourites"])


def require_customer(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.FAVOURITE_MANAGE, user.role):
        raise HTTPException(403)
    return user


@router.get("", response_model=PageResponse[ProductSummary])
def list_favourites(
    user: Annotated[AppUser, Depends(require_customer)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[ProductSummary]:
    scope = (Favourite.user_id == user.id, Product.is_archived.is_(False))
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
    session.execute(
        insert(Favourite).values(user_id=user.id, product_id=product.id).on_conflict_do_nothing()
    )
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
