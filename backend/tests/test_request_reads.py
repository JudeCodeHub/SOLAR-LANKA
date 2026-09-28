"""Customer and company request reads use persisted owner and delivery scope."""

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


def test_customer_and_company_reads_are_isolated(
    database_client, database_connection, database_session
):
    schema = f"request_reads_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, EstimatorConfigVersion, SavedEstimate,
                  CompanyMembership, QuotationRequest, RequestDelivery):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_customer_reads")
    other = AppUser(clerk_subject="user_other_reads")
    staff_a = AppUser(clerk_subject="user_staff_a_reads")
    staff_b = AppUser(clerk_subject="user_staff_b_reads")
    technician = AppUser(clerk_subject="user_tech_reads")
    company_a = Company(name="Fictional installer A", publication_status="approved")
    company_b = Company(name="Fictional installer B", publication_status="approved")
    database_session.add_all([customer, other, staff_a, staff_b, technician, company_a, company_b])
    database_session.flush()
    database_session.add_all([
        CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
        CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="company_admin"),
        CompanyMembership(user_id=technician.id, company_id=company_a.id, role="technician"),
    ])
    request = QuotationRequest(
        customer_id=customer.id,
        requirements={"district": "Colombo", "details": "Rooftop solar quotation"},
    )
    other_request = QuotationRequest(
        customer_id=other.id,
        requirements={"district": "Galle", "details": "Another quotation"},
    )
    database_session.add_all([request, other_request])
    database_session.flush()
    delivery_a = RequestDelivery(request_id=request.id, company_id=company_a.id)
    delivery_b = RequestDelivery(request_id=request.id, company_id=company_b.id)
    other_delivery = RequestDelivery(request_id=other_request.id, company_id=company_b.id)
    database_session.add_all([delivery_a, delivery_b, other_delivery])
    database_session.commit()

    subject = {"value": customer.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject["value"], "session_test"
    )
    customer_path = "/users/me/requests"
    a_path = f"/companies/{company_a.id}/request-deliveries"
    b_path = f"/companies/{company_b.id}/request-deliveries"
    own = database_client.get(customer_path)
    assert own.status_code == 200
    assert own.headers["cache-control"] == "no-store"
    assert own.json()["total"] == 1
    assert {row["company_id"] for row in own.json()["items"][0]["deliveries"]} == {
        str(company_a.id), str(company_b.id)
    }
    customer_detail = database_client.get(f"{customer_path}/{request.id}")
    assert customer_detail.json()["requirements"]["district"] == "Colombo"
    assert database_client.get(f"{customer_path}/{other_request.id}").status_code == 404

    subject["value"] = other.clerk_subject
    assert database_client.get(f"{customer_path}/{request.id}").status_code == 404
    subject["value"] = staff_a.clerk_subject
    inbox_a = database_client.get(a_path)
    assert inbox_a.status_code == 200
    assert inbox_a.json()["total"] == 1
    assert inbox_a.json()["items"][0]["id"] == str(delivery_a.id)
    detail_a = database_client.get(f"{a_path}/{delivery_a.id}")
    assert detail_a.status_code == 200
    assert detail_a.json()["requirements"]["details"] == "Rooftop solar quotation"
    assert "customer_id" not in detail_a.json()
    assert "company_id" not in detail_a.json()
    assert str(delivery_b.id) not in str(detail_a.json())
    assert database_client.get(f"{a_path}/{delivery_b.id}").status_code == 404
    assert database_client.get(b_path).status_code == 403

    subject["value"] = staff_b.clerk_subject
    inbox_b = database_client.get(b_path)
    assert inbox_b.status_code == 200
    assert {row["id"] for row in inbox_b.json()["items"]} == {
        str(delivery_b.id), str(other_delivery.id)
    }
    assert database_client.get(f"{b_path}/{delivery_a.id}").status_code == 404
    subject["value"] = technician.clerk_subject
    assert database_client.get(a_path).status_code == 403
    database_session.refresh(delivery_a)
    assert delivery_a.status == "submitted" and delivery_a.viewed_at is None
