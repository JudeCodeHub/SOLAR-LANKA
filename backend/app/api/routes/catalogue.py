"""Public canonical catalogue lists and stable UUID detail routes."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas.catalogue import (
    InverterSpecifications,
    PanelSpecifications,
    ProductDetail,
    ProductSummary,
)
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.db.session import get_session
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product

router = APIRouter(prefix="/catalogue", tags=["catalogue"])


def _list(
    kind: Literal["panel", "inverter"], session: Session, pagination: PaginationParams
) -> PageResponse[ProductSummary]:
    visible = (Product.kind == kind, Product.is_archived.is_(False))
    total = session.scalar(select(func.count()).select_from(Product).where(*visible)) or 0
    products = session.scalars(
        select(Product)
        .where(*visible)
        .order_by(Product.brand, Product.model, Product.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return PageResponse[ProductSummary](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[ProductSummary.model_validate(product) for product in products],
    )


def _detail(
    kind: Literal["panel", "inverter"], product_id: UUID, session: Session
) -> ProductDetail:
    product = session.scalars(
        select(Product).where(
            Product.id == product_id, Product.kind == kind, Product.is_archived.is_(False)
        )
    ).one_or_none()
    if product is None:
        raise HTTPException(404)
    spec_model = Panel if kind == "panel" else Inverter
    spec_schema = PanelSpecifications if kind == "panel" else InverterSpecifications
    specs = session.get(spec_model, product.id)
    if specs is None:
        raise HTTPException(404)
    return ProductDetail.model_validate(
        {
            "id": product.id,
            "kind": product.kind,
            "brand": product.brand,
            "model": product.model,
            "image_urls": product.image_urls,
            "datasheet_urls": product.datasheet_urls,
            "source_url": product.source_url,
            "verified_at": product.verified_at,
            "created_at": product.created_at,
            "specifications": spec_schema.model_validate(specs),
        }
    )


@router.get("/panels", response_model=PageResponse[ProductSummary])
def list_panels(
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[ProductSummary]:
    response.headers["Cache-Control"] = "no-store"
    return _list("panel", session, pagination)


@router.get("/panels/{product_id}", response_model=ProductDetail)
def panel_detail(
    product_id: UUID, session: Annotated[Session, Depends(get_session)], response: Response
) -> ProductDetail:
    response.headers["Cache-Control"] = "no-store"
    return _detail("panel", product_id, session)


@router.get("/inverters", response_model=PageResponse[ProductSummary])
def list_inverters(
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[ProductSummary]:
    response.headers["Cache-Control"] = "no-store"
    return _list("inverter", session, pagination)


@router.get("/inverters/{product_id}", response_model=ProductDetail)
def inverter_detail(
    product_id: UUID, session: Annotated[Session, Depends(get_session)], response: Response
) -> ProductDetail:
    response.headers["Cache-Control"] = "no-store"
    return _detail("inverter", product_id, session)
