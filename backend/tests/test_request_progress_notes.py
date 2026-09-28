"""Recipient progress is visible; staff follow-up notes stay inside one delivery."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.request_delivery_note import RequestDeliveryNote
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_progress_and_notes_are_scoped_to_recipient(
    database_client, database_connection, database_session
):
    schema = f"request_notes_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser, Company, EstimatorConfigVersion, SavedEstimate,
        CompanyMembership, QuotationRequest, RequestDelivery, RequestDeliveryNote,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_notes_customer")
    staff_a = AppUser(clerk_subject="user_notes_staff_a")
    staff_b = AppUser(clerk_subject="user_notes_staff_b")
    company_a = Company(name="Fictional A", publication_status="approved")
    company_b = Company(name="Fictional B", publication_status="approved")
    database_session.add_all([customer, staff_a, staff_b, company_a, company_b])
    database_session.flush()
    database_session.add_all([
        CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
        CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="sales"),
    ])
    request = QuotationRequest(
        customer_id=customer.id,
        requirements={"district": "Colombo", "details": "Please quote solar panels"},
    )
    database_session.add(request)
    database_session.flush()
    delivery_a = RequestDelivery(request_id=request.id, company_id=company_a.id)
    delivery_b = RequestDelivery(request_id=request.id, company_id=company_b.id)
    database_session.add_all([delivery_a, delivery_b])
    database_session.commit()
    subject = {"value": staff_a.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject["value"], "session_test"
    )
    path_a = f"/companies/{company_a.id}/request-deliveries/{delivery_a.id}"
    path_b = f"/companies/{company_b.id}/request-deliveries/{delivery_b.id}"
    viewed = database_client.patch(f"{path_a}/progress", json={"status": "viewed"})
    assert viewed.status_code == 200
    responding = database_client.patch(f"{path_a}/progress", json={"status": "responding"})
    assert responding.status_code == 200
    assert database_client.patch(f"{path_a}/progress", json={"status": "viewed"}).status_code == 409
    assert database_client.patch(f"{path_a}/progress", json={"status": "closed"}).status_code == 422
    note = database_client.post(f"{path_a}/notes", json={"body": " Call after 5 PM "})
    assert note.status_code == 201
    assert note.json()["body"] == "Call after 5 PM"
    assert note.json()["author_id"] == str(staff_a.id)
    assert database_client.post(f"{path_a}/notes", json={"body": "   "}).status_code == 422
    own_notes = database_client.get(f"{path_a}/notes")
    assert own_notes.status_code == 200
    assert own_notes.json()["total"] == 1
    assert own_notes.json()["items"][0]["body"] == "Call after 5 PM"
    assert database_client.get(f"{path_b}/notes").status_code == 403

    subject["value"] = staff_b.clerk_subject
    other_path = f"/companies/{company_b.id}/request-deliveries/{delivery_a.id}"
    assert database_client.get(f"{other_path}/notes").status_code == 404
    assert database_client.post(f"{other_path}/notes", json={"body": "No"}).status_code == 404
    other_progress = database_client.patch(f"{other_path}/progress", json={"status": "viewed"})
    assert other_progress.status_code == 404
    assert database_client.get(f"{path_b}/notes").json()["total"] == 0

    subject["value"] = customer.clerk_subject
    progress = database_client.get(f"/users/me/requests/{request.id}")
    assert progress.status_code == 200
    assert {item["status"] for item in progress.json()["deliveries"]} == {
        "responding", "submitted"
    }
    assert "Call after 5 PM" not in str(progress.json())
    assert database_client.get(f"{path_a}/notes").status_code == 403
    assert database_client.post(f"{path_a}/notes", json={"body": "No"}).status_code == 403
    database_session.refresh(delivery_a)
    database_session.refresh(delivery_b)
    assert delivery_a.viewed_at is not None
    assert delivery_b.viewed_at is None
