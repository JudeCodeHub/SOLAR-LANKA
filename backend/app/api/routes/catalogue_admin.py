"""Canonical catalogue mutations belong to active platform administrators only."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.catalogue_admin import InverterEdit, PanelEdit, ProductEdit
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.user import AppUser

router = APIRouter(prefix="/admin/products", tags=["catalogue administration"])


def require_product_editor(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.PRODUCT_MANAGE, user.role):
        raise HTTPException(403)
    return user


def locked_product(session: Session, product_id: UUID) -> Product:
    product = session.scalars(
        select(Product).where(Product.id == product_id).with_for_update()
    ).one_or_none()
    if product is None:
        raise HTTPException(404)
    if product.is_archived:
        raise HTTPException(409)
    return product


@router.patch("/{product_id}")
def edit_product(
    product_id: UUID,
    body: ProductEdit,
    editor: Annotated[AppUser, Depends(require_product_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    product = locked_product(session, product_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    session.commit()
    return {"id": str(product.id)}


@router.patch("/{product_id}/panel")
def edit_panel(
    product_id: UUID,
    body: PanelEdit,
    editor: Annotated[AppUser, Depends(require_product_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    product = locked_product(session, product_id)
    if product.kind != "panel":
        raise HTTPException(404)
    panel = session.get(Panel, product_id)
    if panel is None:
        raise HTTPException(404)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(panel, field, value)
    session.commit()
    return {"id": str(product.id)}


@router.patch("/{product_id}/inverter")
def edit_inverter(
    product_id: UUID,
    body: InverterEdit,
    editor: Annotated[AppUser, Depends(require_product_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    product = locked_product(session, product_id)
    if product.kind != "inverter":
        raise HTTPException(404)
    inverter = session.get(Inverter, product_id)
    if inverter is None:
        raise HTTPException(404)
    changes = body.model_dump(exclude_unset=True)
    notes = changes.get("compatibility_notes", inverter.compatibility_notes)
    source = changes.get("compatibility_source_url", inverter.compatibility_source_url)
    if notes is not None and (source is None or not source.strip()):
        raise HTTPException(422)
    for field, value in changes.items():
        setattr(inverter, field, value)
    session.commit()
    return {"id": str(product.id)}


@router.post("/{product_id}/archive")
def archive_product(
    product_id: UUID,
    editor: Annotated[AppUser, Depends(require_product_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str]:
    product = locked_product(session, product_id)
    product.is_archived = True
    session.commit()
    return {"id": str(product.id)}
