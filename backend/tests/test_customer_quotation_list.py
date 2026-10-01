"""A customer can list every offer on their own request, with drafts hidden and expiry visible."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database

TERMS = {
    "lines": [
        {"kind": "charge", "description": "Installation", "quantity": "1", "unit_price": "500"}
    ],
    "capacity_kwp": "5",
    "warranty_terms": "10 years",
    "exclusions": "Roof repairs",
    "validity_days": 30,
}


def test_customer_lists_their_offers_without_drafts(
    database_client, database_connection, database_session
):
    schema = f"customer_offers_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser,
        Company,
        EstimatorConfigVersion,
        SavedEstimate,
        CompanyMembership,
        Product,
        ProductOffer,
        QuotationRequest,
        RequestDelivery,
        Quotation,
        QuotationRevision,
        QuotationLineItem,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_list_customer")
    other = AppUser(clerk_subject="user_list_other")
    staff_a = AppUser(clerk_subject="user_list_staff_a")
    staff_b = AppUser(clerk_subject="user_list_staff_b")
    company_a = Company(name="Fictional A", publication_status="approved")
    company_b = Company(name="Fictional B", publication_status="approved")
    database_session.add_all([customer, other, staff_a, staff_b, company_a, company_b])
    database_session.flush()
    database_session.add_all(
        [
            CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
            CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="sales"),
        ]
    )
    request = QuotationRequest(
        customer_id=customer.id, requirements={"district": "Colombo", "details": "Quote"}
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
    base_a = f"/companies/{company_a.id}/request-deliveries/{delivery_a.id}/quotations"
    base_b = f"/companies/{company_b.id}/request-deliveries/{delivery_b.id}/quotations"
    listing = f"/users/me/requests/{request.id}/quotations"
    # Company A sends revision 1, then revises and sends revision 2; company B keeps a draft.
    quotation_a = database_client.post(base_a).json()
    database_client.put(f"{base_a}/{quotation_a['id']}/draft", json=TERMS)
    assert database_client.post(f"{base_a}/{quotation_a['id']}/send").status_code == 200
    assert database_client.post(f"{base_a}/{quotation_a['id']}/revisions").status_code == 201
    database_client.put(
        f"{base_a}/{quotation_a['id']}/draft",
        json=TERMS | {"lines": [{**TERMS["lines"][0], "unit_price": "600"}]},
    )
    assert database_client.post(f"{base_a}/{quotation_a['id']}/send").status_code == 200
    subject["value"] = staff_b.clerk_subject
    database_client.post(base_b)
    # A draft is never visible to the customer.
    subject["value"] = customer.clerk_subject
    offers = database_client.get(listing)
    assert offers.status_code == 200
    items = offers.json()
    assert len(items) == 1
    assert items[0]["company_id"] == str(company_a.id)
    assert items[0]["revision_number"] == 2
    assert items[0]["status"] == "sent"
    assert items[0]["total"] == "600.00"
    assert items[0]["sent_revision_count"] == 2
    assert items[0]["valid_until"] is not None
    # Once company B sends, both appear, newest first.
    subject["value"] = staff_b.clerk_subject
    quotation_b = database_client.get(f"{base_b}/current").json()
    database_client.put(f"{base_b}/{quotation_b['quotation_id']}/draft", json=TERMS)
    assert database_client.post(f"{base_b}/{quotation_b['quotation_id']}/send").status_code == 200
    subject["value"] = customer.clerk_subject
    both = database_client.get(listing).json()
    assert [item["company_id"] for item in both] == [str(company_b.id), str(company_a.id)]
    # Only the owner can list them; other customers and company staff get not found.
    subject["value"] = other.clerk_subject
    assert database_client.get(listing).status_code == 404
    subject["value"] = staff_a.clerk_subject
    assert database_client.get(listing).status_code == 404
