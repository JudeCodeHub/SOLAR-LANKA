"""A delivery's current quotation and its editable terms can be read back by its staff."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_current_quotation_is_scoped_and_round_trips_the_draft(
    database_client, database_connection, database_session
):
    schema = f"quotation_current_{uuid4().hex}"
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
        OutboxEvent,
    ):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_current_customer")
    staff_a = AppUser(clerk_subject="user_current_staff_a")
    staff_b = AppUser(clerk_subject="user_current_staff_b")
    technician = AppUser(clerk_subject="user_current_technician")
    company_a = Company(name="Fictional A", publication_status="approved")
    company_b = Company(name="Fictional B", publication_status="approved")
    database_session.add_all([customer, staff_a, staff_b, technician, company_a, company_b])
    database_session.flush()
    database_session.add_all(
        [
            CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
            CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="sales"),
            CompanyMembership(user_id=technician.id, company_id=company_a.id, role="technician"),
        ]
    )
    request = QuotationRequest(
        customer_id=customer.id, requirements={"district": "Colombo", "details": "Solar quote"}
    )
    database_session.add(request)
    database_session.flush()
    delivery = RequestDelivery(request_id=request.id, company_id=company_a.id)
    database_session.add(delivery)
    product = Product(kind="panel", brand="Fictional", model="Panel A")
    database_session.add(product)
    database_session.commit()
    subject = {"value": staff_a.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject["value"], "session_test"
    )
    own = f"/companies/{company_a.id}/request-deliveries/{delivery.id}/quotations"
    current = f"{own}/current"
    # Nothing exists yet.
    assert database_client.get(current).status_code == 404
    created = database_client.post(own).json()
    # Another company's staff, a technician and a customer cannot read it.
    for who, expected in (
        (staff_b.clerk_subject, 403),
        (technician.clerk_subject, 403),
        (customer.clerk_subject, 403),
    ):
        subject["value"] = who
        assert database_client.get(current).status_code == expected, who
    subject["value"] = staff_b.clerk_subject
    foreign = f"/companies/{company_b.id}/request-deliveries/{delivery.id}/quotations/current"
    assert database_client.get(foreign).status_code == 404
    subject["value"] = staff_a.clerk_subject
    # A fresh draft has no lines and no totals, and says so.
    empty = database_client.get(current).json()
    assert empty["quotation_id"] == created["id"]
    assert empty["revision_id"] == created["revision_id"]
    assert empty["revision_number"] == 1
    assert empty["status"] == "draft"
    assert empty["terms"]["lines"] == []
    assert empty["terms"]["total"] is None
    assert empty["terms"]["discount_kind"] == "none"
    terms = {
        "lines": [
            {
                "kind": "equipment",
                "product_id": str(product.id),
                "description": "Panel A",
                "quantity": "2",
                "unit_price": "100.05",
            },
            {"kind": "charge", "description": "Installation", "quantity": "1", "unit_price": "50"},
        ],
        "discount_kind": "percent",
        "discount_value": "10",
        "tax_rate_percent": "18",
        "capacity_kwp": "5.25",
        "warranty_terms": "10 years",
        "exclusions": "Roof repairs",
        "validity_days": 30,
        "notes": "Site visit",
    }
    assert database_client.put(f"{own}/{created['id']}/draft", json=terms).status_code == 200
    read = database_client.get(current).json()["terms"]
    assert [(line["position"], line["kind"], line["description"]) for line in read["lines"]] == [
        (1, "equipment", "Panel A"),
        (2, "charge", "Installation"),
    ]
    assert read["lines"][0]["product_id"] == str(product.id)
    assert read["lines"][0]["quantity"] == "2.000"
    assert read["lines"][0]["unit_price"] == "100.05"
    assert [line["line_total"] for line in read["lines"]] == ["200.10", "50.00"]
    assert read["discount_kind"] == "percent"
    assert read["discount_value"] == "10.00"
    assert read["tax_rate_percent"] == "18.00"
    assert read["capacity_kwp"] == "5.250"
    assert read["warranty_terms"] == "10 years"
    assert read["exclusions"] == "Roof repairs"
    assert read["validity_days"] == 30
    assert read["notes"] == "Site visit"
    assert (read["subtotal"], read["discount"], read["tax"], read["total"]) == (
        "250.10",
        "25.01",
        "40.52",
        "265.61",
    )
    # Once sent, the same endpoint reports the sent status with the stored terms.
    assert database_client.post(f"{own}/{created['id']}/send").status_code == 200
    sent = database_client.get(current).json()
    assert sent["status"] == "sent"
    assert sent["terms"]["total"] == "265.61"
