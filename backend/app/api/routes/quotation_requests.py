"""Customer submission creates one request and only its selected deliveries."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.quotation_requests import (
    QuotationRequestCreate,
    QuotationRequestCreated,
    RequestDeliveryCreated,
)
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.company import Company
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

router = APIRouter(prefix="/users/me/requests", tags=["quotation requests"])


def require_request_customer(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.REQUEST_CREATE, user.role):
        raise HTTPException(403)
    return user


@router.post("", status_code=201, response_model=QuotationRequestCreated)
def submit_request(
    body: QuotationRequestCreate,
    user: Annotated[AppUser, Depends(require_request_customer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRequestCreated:
    response.headers["Cache-Control"] = "no-store"
    if body.saved_estimate_id is not None:
        estimate = session.scalars(
            select(SavedEstimate).where(
                SavedEstimate.id == body.saved_estimate_id,
                SavedEstimate.user_id == user.id,
            )
        ).one_or_none()
        if estimate is None:
            raise HTTPException(404)
        if estimate.input_snapshot.get("district") != body.district:
            raise HTTPException(422)

    companies = list(session.scalars(select(Company).where(Company.id.in_(body.company_ids))))
    if len(companies) != len(body.company_ids) or any(
        company.publication_status != "approved"
        or body.district not in company.service_districts
        or "installation" not in company.services
        for company in companies
    ):
        raise HTTPException(422)

    request = QuotationRequest(
        customer_id=user.id,
        saved_estimate_id=body.saved_estimate_id,
        requirements=body.model_dump(
            mode="json", exclude={"saved_estimate_id", "company_ids"}
        ),
    )
    session.add(request)
    session.flush()
    deliveries = [
        RequestDelivery(request_id=request.id, company_id=company_id)
        for company_id in body.company_ids
    ]
    session.add_all(deliveries)
    session.commit()
    return QuotationRequestCreated(
        id=request.id,
        status=request.status,
        deliveries=[
            RequestDeliveryCreated(
                id=delivery.id, company_id=delivery.company_id, status=delivery.status
            )
            for delivery in deliveries
        ],
    )
