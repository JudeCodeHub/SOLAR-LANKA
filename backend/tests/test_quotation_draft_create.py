"""Only addressed company staff can start an active delivery quotation."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.product import Product
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_draft_creation_is_scoped_and_unique(
    database_client, database_connection, database_session
):
    schema = f"quotation_draft_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser, Company, EstimatorConfigVersion, SavedEstimate,
        CompanyMembership, Product, QuotationRequest, RequestDelivery,
        Quotation, QuotationRevision, QuotationLineItem,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_draft_customer")
    staff_a = AppUser(clerk_subject="user_draft_staff_a")
    staff_b = AppUser(clerk_subject="user_draft_staff_b")
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
        requirements={"district": "Colombo", "details": "Solar quote"},
    )
    database_session.add(request)
    database_session.flush()
    delivery = RequestDelivery(request_id=request.id, company_id=company_a.id)
    database_session.add(delivery)
    database_session.commit()
    subject = {"value": staff_b.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject["value"], "session_test"
    )
    foreign_path = f"/companies/{company_b.id}/request-deliveries/{delivery.id}/quotations"
    own_path = f"/companies/{company_a.id}/request-deliveries/{delivery.id}/quotations"
    assert database_client.post(foreign_path).status_code == 404
    subject["value"] = customer.clerk_subject
    assert database_client.post(own_path).status_code == 403
    subject["value"] = staff_a.clerk_subject
    created = database_client.post(own_path)
    assert created.status_code == 201
    assert created.json()["delivery_id"] == str(delivery.id)
    assert created.json()["revision_number"] == 1
    assert created.json()["status"] == "draft"
    assert database_client.post(own_path).status_code == 409
    assert database_session.query(Quotation).count() == 1
    assert database_session.query(QuotationRevision).count() == 1
    product = Product(kind="panel", brand="Fictional", model="Panel A")
    database_session.add(product)
    database_session.commit()
    edit_path = f"{own_path}/{created.json()['id']}/draft"
    terms = {
        "lines": [
            {"kind": "equipment", "product_id": str(product.id),
             "description": "Panel A", "quantity": "2", "unit_price": "100.05"},
            {"kind": "charge", "description": "Installation",
             "quantity": "1", "unit_price": "50.00"},
        ],
        "discount_kind": "percent", "discount_value": "10.00",
        "tax_rate_percent": "18.00",
    }
    assert database_client.put(edit_path, json=terms).status_code == 200
    assert database_session.query(QuotationLineItem).count() == 2
    subject["value"] = staff_b.clerk_subject
    foreign_edit_path = f"{foreign_path}/{created.json()['id']}/draft"
    assert database_client.put(foreign_edit_path, json=terms).status_code == 404
