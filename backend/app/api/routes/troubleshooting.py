"""Troubleshooting references: public exact-model lookup and platform-administrator authoring."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.troubleshooting import (
    AdminReferenceView,
    Lookup,
    ProductRef,
    ReferenceView,
    ReferenceWrite,
)
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.product import Product
from app.models.troubleshooting import TroubleshootingReference
from app.models.user import AppUser

public_router = APIRouter(prefix="/troubleshooting", tags=["troubleshooting"])
admin_router = APIRouter(prefix="/admin/troubleshooting", tags=["troubleshooting administration"])

SUGGESTIONS = 5


def require_editor(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.PRODUCT_MANAGE, user.role):
        raise HTTPException(403)
    return user


def _ref(product: Product) -> ProductRef:
    return ProductRef(id=product.id, kind=product.kind, brand=product.brand, model=product.model)


def _view(row: TroubleshootingReference) -> ReferenceView:
    return ReferenceView(
        id=row.id,
        product_id=row.product_id,
        code=row.code,
        title=row.title,
        steps=list(row.steps),
        safety_level=row.safety_level,
        hazard_warning=row.hazard_warning,
        source_title=row.source_title,
        source_url=row.source_url,
        source_page=row.source_page,
        verified_on=row.verified_on,
        is_sample=row.is_sample,
    )


@public_router.get("", response_model=Lookup)
def look_up(
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    model: Annotated[str | None, Query(max_length=100)] = None,
    product_id: UUID | None = None,
    code: Annotated[str | None, Query(max_length=64)] = None,
) -> Lookup:
    """Published references for exactly one product. A similar model never stands in for it."""
    response.headers["Cache-Control"] = "no-store"
    if (model is None) == (product_id is None):
        raise HTTPException(422, "Give either a model or a product id.")
    query = (model or "").strip()
    if product_id is not None:
        product = session.scalars(
            select(Product).where(Product.id == product_id, Product.is_archived.is_(False))
        ).one_or_none()
        if product is None:
            raise HTTPException(404)
        matches = [product]
    else:
        if not query:
            raise HTTPException(422, "Give a model name.")
        lowered = query.lower()
        matches = list(
            session.scalars(
                select(Product)
                .where(
                    Product.is_archived.is_(False),
                    (func.lower(Product.model) == lowered)
                    | (func.lower(Product.brand + " " + Product.model) == lowered),
                )
                .order_by(Product.brand, Product.model)
                .limit(10)
            )
        )
    if len(matches) > 1:
        return Lookup(
            match="ambiguous",
            product=None,
            references=[],
            suggestions=[_ref(p) for p in matches],
            notice="More than one product has that name. Choose the exact one; "
            "nothing is shown until you do.",
        )
    if not matches:
        like = f"%{query.lower()}%"
        near = session.scalars(
            select(Product)
            .where(
                Product.is_archived.is_(False),
                func.lower(Product.brand + " " + Product.model).like(like),
            )
            .order_by(Product.brand, Product.model)
            .limit(SUGGESTIONS)
        )
        return Lookup(
            match="none",
            product=None,
            references=[],
            suggestions=[_ref(p) for p in near],
            notice="No product has exactly that name, so no instructions are shown. "
            "Instructions for a different model may not apply to yours.",
        )
    product = matches[0]
    statement = select(TroubleshootingReference).where(
        TroubleshootingReference.product_id == product.id,
        TroubleshootingReference.status == "published",
    )
    if code is not None and code.strip():
        statement = statement.where(
            func.lower(TroubleshootingReference.code) == code.strip().lower()
        )
    rows = session.scalars(
        statement.order_by(
            (TroubleshootingReference.safety_level == "hazard").desc(),
            TroubleshootingReference.title,
        )
    ).all()
    notice = (
        ""
        if rows
        else "There is no published reference for this exact model"
        + (" and code" if code and code.strip() else "")
        + ". Contact the manufacturer or a qualified technician."
    )
    return Lookup(
        match="exact",
        product=_ref(product),
        references=[_view(r) for r in rows],
        suggestions=[],
        notice=notice,
    )


# ---- platform administrators ----


def _admin_view(row: TroubleshootingReference) -> AdminReferenceView:
    return AdminReferenceView(
        **_view(row).model_dump(), status=row.status, created_at=row.created_at
    )


def _apply(row: TroubleshootingReference, body: ReferenceWrite) -> None:
    if body.safety_level == "hazard" and not body.hazard_warning:
        raise BusinessConflict("A hazard reference needs its warning text.")
    row.product_id = body.product_id
    row.code = body.code
    row.title = body.title or ""
    row.steps = body.steps
    row.safety_level = body.safety_level
    row.hazard_warning = body.hazard_warning
    row.source_title = body.source_title.strip()
    row.source_url = str(body.source_url)
    row.source_page = body.source_page
    row.verified_on = (
        datetime(body.verified_on.year, body.verified_on.month, body.verified_on.day, tzinfo=UTC)
        if body.verified_on
        else None
    )
    row.is_sample = body.is_sample


def _product(session: Session, product_id: UUID) -> Product:
    product = session.get(Product, product_id)
    if product is None or product.is_archived:
        raise HTTPException(404)
    return product


def _locked(session: Session, reference_id: UUID) -> TroubleshootingReference:
    row = session.scalars(
        select(TroubleshootingReference)
        .where(TroubleshootingReference.id == reference_id)
        .with_for_update()
    ).one_or_none()
    if row is None:
        raise HTTPException(404)
    return row


@admin_router.get("", response_model=list[AdminReferenceView])
def list_references(
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    product_id: UUID | None = None,
) -> list[AdminReferenceView]:
    response.headers["Cache-Control"] = "no-store"
    statement = select(TroubleshootingReference).order_by(
        TroubleshootingReference.created_at.desc(), TroubleshootingReference.id
    )
    if product_id is not None:
        statement = statement.where(TroubleshootingReference.product_id == product_id)
    return [_admin_view(r) for r in session.scalars(statement.limit(200))]


@admin_router.post("", response_model=AdminReferenceView, status_code=201)
def create_reference(
    body: ReferenceWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminReferenceView:
    _product(session, body.product_id)
    row = TroubleshootingReference(created_by=editor.id, status="draft")
    _apply(row, body)
    session.add(row)
    session.flush()
    view = _admin_view(row)
    session.commit()
    return view


@admin_router.put("/{reference_id}", response_model=AdminReferenceView)
def edit_reference(
    reference_id: UUID,
    body: ReferenceWrite,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminReferenceView:
    row = _locked(session, reference_id)
    if row.status != "draft":
        raise BusinessConflict("Only a draft can be edited. Archive it and write a new one.")
    _product(session, body.product_id)
    _apply(row, body)
    session.flush()
    view = _admin_view(row)
    session.commit()
    return view


@admin_router.post("/{reference_id}/publish", response_model=AdminReferenceView)
def publish_reference(
    reference_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminReferenceView:
    row = _locked(session, reference_id)
    if row.status != "draft":
        raise BusinessConflict("Only a draft can be published.")
    if row.verified_on is None:
        raise BusinessConflict("Say when this was checked against its source before publishing.")
    _product(session, row.product_id)
    row.status = "published"
    session.flush()
    view = _admin_view(row)
    session.commit()
    return view


@admin_router.post("/{reference_id}/archive", response_model=AdminReferenceView)
def archive_reference(
    reference_id: UUID,
    editor: Annotated[AppUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_session)],
) -> AdminReferenceView:
    row = _locked(session, reference_id)
    if row.status == "archived":
        raise BusinessConflict("This reference is already archived.")
    row.status = "archived"
    session.flush()
    view = _admin_view(row)
    session.commit()
    return view
