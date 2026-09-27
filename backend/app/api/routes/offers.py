"""Company offers are scoped by persisted active membership on every request."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.schemas.offers import OfferCreate, OfferResponse, OfferUpdate
from app.api.schemas.pagination import PaginationParams
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.product import Product
from app.models.product_offer import ProductOffer

router = APIRouter(prefix="/companies/{company_id}/offers", tags=["company offers"])
OfferManager = Annotated[
    CompanyMembership, Depends(require_company_permission(Action.PRODUCT_OFFER_MANAGE))
]


def _offer(session: Session, membership: CompanyMembership, offer_id: UUID) -> ProductOffer:
    offer = session.scalars(
        select(ProductOffer)
        .where(ProductOffer.id == offer_id, ProductOffer.company_id == membership.company_id)
        .with_for_update()
    ).one_or_none()
    if offer is None:
        raise HTTPException(404)
    return offer


@router.get("", response_model=list[OfferResponse])
def list_offers(
    membership: OfferManager,
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> list[OfferResponse]:
    offers = session.scalars(
        select(ProductOffer)
        .where(ProductOffer.company_id == membership.company_id)
        .order_by(ProductOffer.created_at.desc(), ProductOffer.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    response.headers["Cache-Control"] = "no-store"
    return [OfferResponse.model_validate(offer) for offer in offers]


@router.post("", response_model=OfferResponse, status_code=201)
def create_offer(
    body: OfferCreate,
    membership: OfferManager,
    session: Annotated[Session, Depends(get_session)],
) -> OfferResponse:
    product = session.get(Product, body.product_id)
    if product is None or product.is_archived:
        raise HTTPException(404)
    offer = ProductOffer(
        company_id=membership.company_id,
        product_id=product.id,
        **body.model_dump(exclude={"product_id"}, exclude_unset=True),
    )
    session.add(offer)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise BusinessConflict("This company already has an offer for this product.") from None
    result = OfferResponse.model_validate(offer)
    session.commit()
    return result


@router.patch("/{offer_id}", response_model=OfferResponse)
def edit_offer(
    offer_id: UUID,
    body: OfferUpdate,
    membership: OfferManager,
    session: Annotated[Session, Depends(get_session)],
) -> OfferResponse:
    offer = _offer(session, membership, offer_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(offer, field, value)
    result = OfferResponse.model_validate(offer)
    session.commit()
    return result
