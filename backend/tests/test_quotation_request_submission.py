"""Only customers can submit to approved, matching companies and owned estimates."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from tests.test_estimate_preview import request_body
from tests.test_estimator_finance import financial_config

pytestmark = pytest.mark.database


def test_customer_submission_rejects_foreign_estimates_and_ineligible_companies(
    database_client, database_connection, database_session
):
    schema = f"request_submit_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser, Company, EstimatorConfigVersion, SavedEstimate,
        QuotationRequest, RequestDelivery,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_request_owner")
    other = AppUser(clerk_subject="user_request_other")
    admin = AppUser(clerk_subject="user_request_admin", role="platform_admin")
    eligible_a = Company(
        name="Fictional installer A", publication_status="approved",
        service_districts=["Colombo"], services=["installation"],
    )
    eligible_b = Company(
        name="Fictional installer B", publication_status="approved",
        service_districts=["Colombo"], services=["installation"],
    )
    unpublished = Company(
        name="Unpublished installer", publication_status="draft",
        service_districts=["Colombo"], services=["installation"],
    )
    wrong_district = Company(
        name="Out of district", publication_status="approved",
        service_districts=["Galle"], services=["installation"],
    )
    wrong_service = Company(
        name="Repair only", publication_status="approved",
        service_districts=["Colombo"], services=["repair"],
    )
    config = financial_config()
    config.published_at = datetime.now(UTC)
    database_session.add_all([
        customer, other, admin, eligible_a, eligible_b, unpublished,
        wrong_district, wrong_service, config,
    ])
    database_session.commit()

    current_subject = {"value": customer.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        current_subject["value"], "session_test"
    )
    estimate_path = "/users/me/estimates"
    owned_estimate = database_client.post(estimate_path, json=request_body()).json()["id"]
    current_subject["value"] = other.clerk_subject
    foreign_estimate = database_client.post(estimate_path, json=request_body()).json()["id"]
    current_subject["value"] = customer.clerk_subject

    route = "/users/me/requests"
    def submit(payload):
        return database_client.post(
            route, json=payload, headers={"Idempotency-Key": str(uuid4())}
        )

    body = {
        "district": "Colombo",
        "details": "Please quote an on-grid rooftop installation.",
        "monthly_consumption_kwh": "0",
        "saved_estimate_id": owned_estimate,
        "company_ids": [str(eligible_a.id), str(eligible_b.id)],
    }
    created = submit(body)
    assert created.status_code == 201
    result = created.json()
    assert created.headers["cache-control"] == "no-store"
    assert result["status"] == "submitted"
    assert {delivery["company_id"] for delivery in result["deliveries"]} == {
        str(eligible_a.id), str(eligible_b.id)
    }
    assert len({delivery["id"] for delivery in result["deliveries"]}) == 2
    request = database_session.get(QuotationRequest, result["id"])
    assert request.customer_id == customer.id
    assert str(request.saved_estimate_id) == owned_estimate
    assert request.requirements["monthly_consumption_kwh"] == "0"
    assert database_session.scalar(
        select(func.count()).select_from(RequestDelivery).where(
            RequestDelivery.request_id == request.id
        )
    ) == 2

    cases = [
        ({"saved_estimate_id": foreign_estimate}, 404),
        ({"saved_estimate_id": str(uuid4())}, 404),
        ({"company_ids": [str(unpublished.id)]}, 422),
        ({"company_ids": [str(wrong_district.id)]}, 422),
        ({"company_ids": [str(wrong_service.id)]}, 422),
        ({"company_ids": [str(uuid4())]}, 422),
        ({"company_ids": [str(eligible_a.id), str(eligible_a.id)]}, 422),
    ]
    for change, status in cases:
        assert submit({**body, **change}).status_code == status
    assert database_session.scalar(select(func.count()).select_from(QuotationRequest)) == 1
    assert database_session.scalar(select(func.count()).select_from(RequestDelivery)) == 2

    without_estimate = submit(
        {**body, "saved_estimate_id": None, "company_ids": [str(eligible_a.id)]}
    )
    assert without_estimate.status_code == 201
    current_subject["value"] = admin.clerk_subject
    assert submit(body).status_code == 403
