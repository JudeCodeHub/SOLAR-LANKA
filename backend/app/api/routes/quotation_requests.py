"""Customer submission creates one request per idempotency key."""

import json
from hashlib import sha256
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.quotation_requests import (
    QuotationRequestCreate,
    QuotationRequestCreated,
    RequestDeliveryCreated,
)
from app.api.schemas.request_reads import (
    CustomerRequestDetail,
    CustomerRequestSummary,
    DeliveryProgress,
    RequestStatusResponse,
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


def require_request_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.REQUEST_READ, user.role):
        raise HTTPException(403)
    return user


def require_request_withdrawer(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.REQUEST_WITHDRAW, user.role):
        raise HTTPException(403)
    return user


@router.post("/{request_id}/withdraw", response_model=RequestStatusResponse)
def withdraw_request(
    request_id: UUID,
    user: Annotated[AppUser, Depends(require_request_withdrawer)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> RequestStatusResponse:
    response.headers["Cache-Control"] = "no-store"
    request = session.scalars(
        select(QuotationRequest)
        .where(QuotationRequest.id == request_id, QuotationRequest.customer_id == user.id)
        .with_for_update()
    ).one_or_none()
    if request is None:
        raise HTTPException(404)
    if request.status != "submitted":
        raise BusinessConflict("Only an active request can be withdrawn.")
    deliveries = list(session.scalars(
        select(RequestDelivery)
        .where(RequestDelivery.request_id == request.id)
        .order_by(RequestDelivery.id)
        .with_for_update()
    ))
    if any(delivery.status in {"responding", "closed"} for delivery in deliveries):
        raise BusinessConflict("A request with a company response cannot be withdrawn.")
    request.status = "cancelled"
    for delivery in deliveries:
        delivery.status = "cancelled"
    session.commit()
    return RequestStatusResponse(id=request.id, status="cancelled")


def progress(delivery: RequestDelivery) -> DeliveryProgress:
    return DeliveryProgress(
        id=delivery.id,
        company_id=delivery.company_id,
        status=delivery.status,
        created_at=delivery.created_at,
        viewed_at=delivery.viewed_at,
    )


@router.get("", response_model=PageResponse[CustomerRequestSummary])
def list_requests(
    user: Annotated[AppUser, Depends(require_request_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[CustomerRequestSummary]:
    response.headers["Cache-Control"] = "no-store"
    total = session.scalar(
        select(func.count()).select_from(QuotationRequest)
        .where(QuotationRequest.customer_id == user.id)
    ) or 0
    requests = list(session.scalars(
        select(QuotationRequest)
        .where(QuotationRequest.customer_id == user.id)
        .order_by(QuotationRequest.created_at.desc(), QuotationRequest.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    ))
    deliveries_by_request: dict[UUID, list[DeliveryProgress]] = {
        request.id: [] for request in requests
    }
    if requests:
        deliveries = session.scalars(
            select(RequestDelivery)
            .where(RequestDelivery.request_id.in_(deliveries_by_request))
            .order_by(RequestDelivery.created_at, RequestDelivery.id)
        )
        for delivery in deliveries:
            deliveries_by_request[delivery.request_id].append(progress(delivery))
    return PageResponse[CustomerRequestSummary](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[
            CustomerRequestSummary(
                id=request.id,
                status=request.status,
                created_at=request.created_at,
                deliveries=deliveries_by_request[request.id],
            )
            for request in requests
        ],
    )


@router.get("/{request_id}", response_model=CustomerRequestDetail)
def request_detail(
    request_id: UUID,
    user: Annotated[AppUser, Depends(require_request_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> CustomerRequestDetail:
    response.headers["Cache-Control"] = "no-store"
    request = session.scalars(
        select(QuotationRequest).where(
            QuotationRequest.id == request_id,
            QuotationRequest.customer_id == user.id,
        )
    ).one_or_none()
    if request is None:
        raise HTTPException(404)
    deliveries = session.scalars(
        select(RequestDelivery)
        .where(RequestDelivery.request_id == request.id)
        .order_by(RequestDelivery.created_at, RequestDelivery.id)
    )
    return CustomerRequestDetail(
        id=request.id,
        status=request.status,
        created_at=request.created_at,
        deliveries=[progress(delivery) for delivery in deliveries],
        requirements=request.requirements,
        saved_estimate_id=request.saved_estimate_id,
    )


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
