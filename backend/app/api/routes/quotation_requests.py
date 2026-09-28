"""Customer submission creates one request per idempotency key."""

import json
from hashlib import sha256
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.quotation_requests import (
    QuotationRequestCreate,
    QuotationRequestCreated,
    RequestDeliveryCreated,
)
from app.core.permissions import Action, Scope, required_scopes
from app.core.value_types import new_entity_id
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


def submission_fingerprint(body: QuotationRequestCreate) -> str:
    payload = body.model_dump(mode="json")
    payload["company_ids"] = sorted(payload["company_ids"])
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return sha256(encoded).hexdigest()


def replay(
    session: Session, *, customer_id: UUID, key: UUID, fingerprint: str
) -> QuotationRequestCreated | None:
    existing = session.scalars(
        select(QuotationRequest).where(
            QuotationRequest.customer_id == customer_id,
            QuotationRequest.idempotency_key == key,
        )
    ).one_or_none()
    if existing is None:
        return None
    if existing.submission_fingerprint != fingerprint:
        raise BusinessConflict("This submission key was already used for a different request.")
    return QuotationRequestCreated.model_validate(existing.submission_response)


@router.post("", status_code=201, response_model=QuotationRequestCreated)
def submit_request(
    body: QuotationRequestCreate,
    key: Annotated[UUID, Header(alias="Idempotency-Key")],
    user: Annotated[AppUser, Depends(require_request_customer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> QuotationRequestCreated:
    response.headers["Cache-Control"] = "no-store"
    fingerprint = submission_fingerprint(body)
    existing = replay(session, customer_id=user.id, key=key, fingerprint=fingerprint)
    if existing is not None:
        response.status_code = 200
        return existing

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

    request_id = new_entity_id()
    deliveries = [
        RequestDelivery(id=new_entity_id(), request_id=request_id, company_id=company_id)
        for company_id in body.company_ids
    ]
    created = QuotationRequestCreated(
        id=request_id,
        status="submitted",
        deliveries=[
            RequestDeliveryCreated(
                id=delivery.id, company_id=delivery.company_id, status="submitted"
            )
            for delivery in deliveries
        ],
    )
    inserted = session.execute(
        insert(QuotationRequest)
        .values(
            id=request_id,
            customer_id=user.id,
            saved_estimate_id=body.saved_estimate_id,
            requirements=body.model_dump(
                mode="json", exclude={"saved_estimate_id", "company_ids"}
            ),
            status="submitted",
            idempotency_key=key,
            submission_fingerprint=fingerprint,
            submission_response=created.model_dump(mode="json"),
        )
        .on_conflict_do_nothing(
            index_elements=[QuotationRequest.customer_id, QuotationRequest.idempotency_key]
        )
        .returning(QuotationRequest.id)
    ).scalar_one_or_none()
    if inserted is None:
        # A concurrent request with this key won; the unique index settled the race.
        existing = replay(session, customer_id=user.id, key=key, fingerprint=fingerprint)
        if existing is None:
            raise HTTPException(503)
        response.status_code = 200
        return existing
    session.add_all(deliveries)
    session.commit()
    return created
