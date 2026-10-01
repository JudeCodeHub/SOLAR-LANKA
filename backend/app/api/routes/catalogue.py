"""Public canonical catalogue lists and stable UUID detail routes."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.schemas.catalogue import (
    InverterSpecifications,
    PanelSpecifications,
    ProductDetail,
    ProductListItem,
    ProductSummary,
    PublicProductOffer,
)
from app.api.schemas.catalogue_filters import InverterQuery, PanelQuery
from app.api.schemas.comparison import (
    PANEL_UNITS,
    PanelComparisonRequest,
    PanelComparisonResponse,
)
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.db.session import get_session
from app.models.company import Company
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.services.public_media import public_media_for

router = APIRouter(prefix="/catalogue", tags=["catalogue"])


def _search_pattern(value: str) -> str:
    escaped = value.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _list(
    kind: Literal["panel", "inverter"], session: Session, pagination: PanelQuery | InverterQuery
) -> PageResponse[ProductListItem]:
    spec_model = Panel if kind == "panel" else Inverter
    conditions = [Product.kind == kind, Product.is_archived.is_(False)]
    if pagination.search:
        pattern = _search_pattern(pagination.search)
        conditions.append(
            or_(
                func.lower(Product.brand).like(pattern, escape="\\"),
                func.lower(Product.model).like(pattern, escape="\\"),
            )
        )
    if isinstance(pagination, PanelQuery):
        if pagination.min_wattage_w is not None:
            conditions.append(Panel.wattage_w >= pagination.min_wattage_w)
        if pagination.max_wattage_w is not None:
            conditions.append(Panel.wattage_w <= pagination.max_wattage_w)
        if pagination.min_efficiency_percent is not None:
            conditions.append(Panel.efficiency_percent >= pagination.min_efficiency_percent)
    else:
        if pagination.category is not None:
            conditions.append(Inverter.category == pagination.category)
        if pagination.min_capacity_kw is not None:
            conditions.append(Inverter.capacity_kw >= pagination.min_capacity_kw)
        if pagination.max_capacity_kw is not None:
            conditions.append(Inverter.capacity_kw <= pagination.max_capacity_kw)
    base = (
        select(Product, spec_model)
        .join(spec_model, spec_model.product_id == Product.id)
        .where(*conditions)
    )
    total = (
        session.scalar(
            select(func.count())
            .select_from(Product)
            .join(spec_model, spec_model.product_id == Product.id)
            .where(*conditions)
        )
        or 0
    )
    rows = list(
        session.execute(
            base.order_by(Product.brand, Product.model, Product.id)
            .limit(pagination.limit)
            .offset(pagination.offset)
        ).all()
    )
    media = public_media_for(
        session,
        parent_kind="product",
        parent_ids=[product.id for product, _ in rows],
        categories=("product_image", "product_datasheet"),
    )

    def highlights(specs: Panel | Inverter) -> dict[str, object]:
        if isinstance(specs, Panel):
            return {"wattage_w": specs.wattage_w, "efficiency_percent": specs.efficiency_percent}
        return {"category": specs.category, "capacity_kw": specs.capacity_kw}

    return PageResponse[ProductListItem](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[
            ProductListItem.model_validate(product).model_copy(
                update={"media": media.get(product.id, []), **highlights(specs)}
            )
            for product, specs in rows
        ],
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
    media = public_media_for(
        session,
        parent_kind="product",
        parent_ids=[product.id],
        categories=("product_image", "product_datasheet"),
    )
    return ProductDetail.model_validate(
        {
            "id": product.id,
            "kind": product.kind,
            "brand": product.brand,
            "model": product.model,
            "media": media.get(product.id, []),
            "image_urls": product.image_urls,
            "datasheet_urls": product.datasheet_urls,
            "source_url": product.source_url,
            "verified_at": product.verified_at,
            "created_at": product.created_at,
            "specifications": spec_schema.model_validate(specs),
        }
    )


def _offers(
    kind: Literal["panel", "inverter"],
    product_id: UUID,
    session: Session,
    pagination: PaginationParams,
) -> PageResponse[PublicProductOffer]:
    """Offers for one published product, from approved companies only."""
    product = session.scalars(
        select(Product).where(
            Product.id == product_id, Product.kind == kind, Product.is_archived.is_(False)
        )
    ).one_or_none()
    if product is None:
        raise HTTPException(404)
    conditions = [
        ProductOffer.product_id == product.id,
        Company.publication_status == "approved",
    ]
    join = ProductOffer.company_id == Company.id
    total = (
        session.scalar(
            select(func.count()).select_from(ProductOffer).join(Company, join).where(*conditions)
        )
        or 0
    )
    rows = session.execute(
        select(ProductOffer, Company.name)
        .join(Company, join)
        .where(*conditions)
        .order_by(Company.name, ProductOffer.id)
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    return PageResponse[PublicProductOffer](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[
            PublicProductOffer(
                company_id=offer.company_id,
                company_name=company_name,
                indicative_price=offer.indicative_price,
                currency=offer.currency,
                is_demo_price=offer.is_demo_price,
                company_claim=offer.company_claim,
                claim_label=offer.claim_label,
            )
            for offer, company_name in rows
        ],
    )


@router.get("/panels", response_model=PageResponse[ProductListItem])
def list_panels(
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PanelQuery, Query()],
    response: Response,
) -> PageResponse[ProductSummary]:
    response.headers["Cache-Control"] = "no-store"
    return _list("panel", session, pagination)


@router.post("/panels/compare", response_model=PanelComparisonResponse)
def compare_panels(
    body: PanelComparisonRequest,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> PanelComparisonResponse:
    items = [_detail("panel", product_id, session) for product_id in body.product_ids]
    response.headers["Cache-Control"] = "no-store"
    return PanelComparisonResponse(items=items, units=PANEL_UNITS)


@router.get("/panels/{product_id}", response_model=ProductDetail)
def panel_detail(
    product_id: UUID, session: Annotated[Session, Depends(get_session)], response: Response
) -> ProductDetail:
    response.headers["Cache-Control"] = "no-store"
    return _detail("panel", product_id, session)


@router.get("/inverters", response_model=PageResponse[ProductListItem])
def list_inverters(
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[InverterQuery, Query()],
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


@router.get("/panels/{product_id}/offers", response_model=PageResponse[PublicProductOffer])
def panel_offers(
    product_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[PublicProductOffer]:
    response.headers["Cache-Control"] = "no-store"
    return _offers("panel", product_id, session, pagination)


@router.get("/inverters/{product_id}/offers", response_model=PageResponse[PublicProductOffer])
def inverter_offers(
    product_id: UUID,
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[PublicProductOffer]:
    response.headers["Cache-Control"] = "no-store"
    return _offers("inverter", product_id, session, pagination)
