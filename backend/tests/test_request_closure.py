"""Withdrawal and closure preserve customer and recipient isolation."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_withdrawal_and_closure_rules(database_client, database_connection, database_session):
    schema = f"request_closure_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser, Company, EstimatorConfigVersion, SavedEstimate,
        CompanyMembership, QuotationRequest, RequestDelivery,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_closure_customer")
    stranger = AppUser(clerk_subject="user_closure_stranger")
    staff_a = AppUser(clerk_subject="user_closure_staff_a")
    staff_b = AppUser(clerk_subject="user_closure_staff_b")
    company_a = Company(name="Fictional A", publication_status="approved")
    company_b = Company(name="Fictional B", publication_status="approved")
    database_session.add_all([customer, stranger, staff_a, staff_b, company_a, company_b])
    database_session.flush()
    database_session.add_all([
        CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
        CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="sales"),
    ])
    requests = [
        QuotationRequest(
            customer_id=customer.id,
            requirements={"district": "Colombo", "details": "Solar quote"},
        )
        for _ in range(3)
    ]
    database_session.add_all(requests)
    database_session.flush()
    deliveries = [
        [RequestDelivery(request_id=request.id, company_id=company.id)
         for company in (company_a, company_b)]
        for request in requests
    ]
    database_session.add_all(item for pair in deliveries for item in pair)
    database_session.commit()
    subject = {"value": stranger.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject["value"], "session_test"
    )
    def withdraw(request):
        return database_client.post(f"/users/me/requests/{request.id}/withdraw")

    def delivery_path(company, delivery):
        return f"/companies/{company.id}/request-deliveries/{delivery.id}"

    assert withdraw(requests[0]).status_code == 404
    subject["value"] = staff_a.clerk_subject
    foreign_close = database_client.post(delivery_path(company_a, deliveries[0][1]) + "/close")
    assert foreign_close.status_code == 404
    subject["value"] = customer.clerk_subject
    assert withdraw(requests[0]).status_code == 200
    assert withdraw(requests[0]).status_code == 409
    database_session.refresh(requests[0])
    for delivery in deliveries[0]:
        database_session.refresh(delivery)
        assert delivery.status == "cancelled"
    assert requests[0].status == "cancelled"
    subject["value"] = staff_a.clerk_subject
    cancelled_close = database_client.post(delivery_path(company_a, deliveries[0][0]) + "/close")
    assert cancelled_close.status_code == 409
    assert database_client.patch(
        delivery_path(company_a, deliveries[0][0]) + "/progress", json={"status": "viewed"}
    ).status_code == 409

    first = database_client.post(delivery_path(company_a, deliveries[1][0]) + "/close")
    assert first.status_code == 200
    assert first.json()["request_status"] == "submitted"
    repeated_close = database_client.post(delivery_path(company_a, deliveries[1][0]) + "/close")
    assert repeated_close.status_code == 409
    subject["value"] = customer.clerk_subject
    assert withdraw(requests[1]).status_code == 409
    subject["value"] = staff_b.clerk_subject
    second = database_client.post(delivery_path(company_b, deliveries[1][1]) + "/close")
    assert second.status_code == 200
    assert second.json()["request_status"] == "closed"
    database_session.refresh(requests[1])
    assert requests[1].status == "closed"
    subject["value"] = customer.clerk_subject
    assert withdraw(requests[1]).status_code == 409

    subject["value"] = staff_a.clerk_subject
    assert database_client.patch(
        delivery_path(company_a, deliveries[2][0]) + "/progress",
        json={"status": "responding"},
    ).status_code == 200
    subject["value"] = customer.clerk_subject
    assert withdraw(requests[2]).status_code == 409
    database_session.refresh(requests[2])
    assert requests[2].status == "submitted"
