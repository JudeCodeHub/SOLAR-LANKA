"""Idempotency keys prevent duplicate request and delivery creation on retries."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_retries_replay_original_response_without_duplicate_deliveries(
    database_client, database_connection, database_session
):
    schema = f"request_retry_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser, Company, EstimatorConfigVersion, SavedEstimate,
        QuotationRequest, RequestDelivery,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_retry_customer")
    other = AppUser(clerk_subject="user_retry_other")
    company = Company(
        name="Fictional installer", publication_status="approved",
        service_districts=["Colombo"], services=["installation"],
    )
    database_session.add_all([customer, other, company])
    database_session.commit()
    current_subject = {"value": customer.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        current_subject["value"], "session_test"
    )
    route = "/users/me/requests"
    key = str(uuid4())
    headers = {"Idempotency-Key": key}
    body = {
        "district": "Colombo",
        "details": "Please quote a rooftop installation.",
        "company_ids": [str(company.id)],
    }
    assert database_client.post(route, json=body).status_code == 422
    first = database_client.post(route, json=body, headers=headers)
    assert first.status_code == 201
    original = first.json()
    assert len(original["deliveries"]) == 1

    delivery = database_session.get(RequestDelivery, original["deliveries"][0]["id"])
    delivery.status = "viewed"
    database_session.commit()
    retry = database_client.post(route, json=body, headers=headers)
    assert retry.status_code == 200
    assert retry.json() == original
    changed = database_client.post(
        route, json={**body, "details": "A different request"}, headers=headers
    )
    assert changed.status_code == 409
    assert database_session.scalar(select(func.count()).select_from(QuotationRequest)) == 1
    assert database_session.scalar(select(func.count()).select_from(RequestDelivery)) == 1

    current_subject["value"] = other.clerk_subject
    other_submission = database_client.post(route, json=body, headers=headers)
    assert other_submission.status_code == 201
    assert other_submission.json()["id"] != original["id"]
    assert database_session.scalar(select(func.count()).select_from(QuotationRequest)) == 2
    assert database_session.scalar(select(func.count()).select_from(RequestDelivery)) == 2
