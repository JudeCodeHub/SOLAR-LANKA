"""Only addressed company staff can start an active delivery quotation."""

from decimal import Decimal
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


def test_draft_creation_is_scoped_and_unique(
    database_client, database_connection, database_session
):
    schema = f"quotation_draft_{uuid4().hex}"
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
    customer = AppUser(clerk_subject="user_draft_customer")
    staff_a = AppUser(clerk_subject="user_draft_staff_a")
    staff_b = AppUser(clerk_subject="user_draft_staff_b")
    company_a = Company(name="Fictional A", publication_status="approved")
    company_b = Company(name="Fictional B", publication_status="approved")
    database_session.add_all([customer, staff_a, staff_b, company_a, company_b])
    database_session.flush()
    database_session.add_all(
        [
            CompanyMembership(user_id=staff_a.id, company_id=company_a.id, role="sales"),
            CompanyMembership(user_id=staff_b.id, company_id=company_b.id, role="sales"),
        ]
    )
    request = QuotationRequest(
        customer_id=customer.id,
        requirements={"district": "Colombo", "details": "Solar quote"},
    )
    database_session.add(request)
    database_session.flush()
    delivery = RequestDelivery(request_id=request.id, company_id=company_a.id)
    delivery_b = RequestDelivery(request_id=request.id, company_id=company_b.id)
    database_session.add_all([delivery, delivery_b])
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
    assert database_client.post(f"{own_path}/{created.json()['id']}/send").status_code == 422
    assert database_client.post(own_path).status_code == 409
    assert database_session.query(Quotation).count() == 1
    assert database_session.query(QuotationRevision).count() == 1
    product = Product(kind="panel", brand="Fictional", model="Panel A")
    database_session.add(product)
    database_session.flush()
    offer = ProductOffer(
        company_id=company_a.id,
        product_id=product.id,
        indicative_price=Decimal("100.05"),
        currency="LKR",
    )
    database_session.add(offer)
    database_session.commit()
    edit_path = f"{own_path}/{created.json()['id']}/draft"
    terms = {
        "lines": [
            {
                "kind": "equipment",
                "product_id": str(product.id),
                "description": "Panel A",
                "quantity": "2",
                "unit_price": "100.05",
            },
            {
                "kind": "charge",
                "description": "Installation",
                "quantity": "1",
                "unit_price": "50.00",
            },
        ],
        "discount_kind": "percent",
        "discount_value": "10.00",
        "tax_rate_percent": "18.00",
        "capacity_kwp": "5.250",
        "warranty_terms": "Panel warranty: 10 years",
        "exclusions": "Roof repairs excluded",
        "validity_days": 30,
        "notes": "Site visit required",
    }
    assert database_client.put(edit_path, json=terms | {"total": "0.01"}).status_code == 422
    saved = database_client.put(edit_path, json=terms)
    assert saved.status_code == 200
    assert saved.json()["total"] == "265.61"
    revision = database_session.query(QuotationRevision).one()
    database_session.refresh(revision)
    assert str(revision.total) == "265.61"
    assert revision.capacity_kwp == Decimal("5.250")
    assert revision.warranty_terms == "Panel warranty: 10 years"
    assert revision.validity_days == 30
    assert [
        str(line.line_total)
        for line in database_session.query(QuotationLineItem).order_by(QuotationLineItem.position)
    ] == ["200.10", "50.00"]
    subject["value"] = staff_b.clerk_subject
    foreign_edit_path = f"{foreign_path}/{created.json()['id']}/draft"
    assert database_client.put(foreign_edit_path, json=terms).status_code == 404
    subject["value"] = staff_a.clerk_subject
    send_path = f"{own_path}/{created.json()['id']}/send"
    sent = database_client.post(send_path)
    assert sent.status_code == 200
    assert sent.json()["status"] == "sent"
    assert sent.json()["total"] == "265.61"
    assert sent.json()["lines"][0]["product_snapshot"]["model"] == "Panel A"
    assert database_client.post(send_path).status_code == 409
    assert database_client.put(edit_path, json=terms).status_code == 409
    product.model = "Panel B"
    offer.indicative_price = Decimal("999.00")
    database_session.commit()
    line = database_session.query(QuotationLineItem).filter_by(kind="equipment").one()
    database_session.refresh(line)
    database_session.refresh(revision)
    assert line.product_snapshot["model"] == "Panel A"
    assert line.unit_price == Decimal("100.05")
    assert revision.total == Decimal("265.61")
    customer_history = (
        f"/users/me/requests/{request.id}/quotations/{created.json()['id']}/revisions"
    )
    subject["value"] = customer.clerk_subject
    initial_history = database_client.get(customer_history)
    assert initial_history.status_code == 200
    assert initial_history.json()["total"] == 1
    assert initial_history.json()["items"][0]["lines"][0]["product_snapshot"]["model"] == "Panel A"
    subject["value"] = staff_b.clerk_subject
    assert database_client.get(customer_history).status_code == 404
    subject["value"] = staff_a.clerk_subject
    revisions_path = f"{own_path}/{created.json()['id']}/revisions"
    replacement = database_client.post(revisions_path)
    assert replacement.status_code == 201
    assert replacement.json()["revision_number"] == 2
    assert database_client.post(revisions_path).status_code == 409
    assert database_client.get(revisions_path).json()["total"] == 2
    subject["value"] = customer.clerk_subject
    assert database_client.get(customer_history).json()["total"] == 1
    draft_detail = f"{customer_history}/{replacement.json()['revision_id']}"
    assert database_client.get(draft_detail).status_code == 404
    subject["value"] = staff_a.clerk_subject
    assert database_client.post(send_path).status_code == 200
    history = database_client.get(revisions_path).json()["items"]
    assert [item["status"] for item in history] == ["sent", "revised"]
    assert (
        database_client.post(
            f"{revisions_path}/{created.json()['revision_id']}/withdraw"
        ).status_code
        == 409
    )
    assert history[1]["lines"][0]["product_snapshot"]["model"] == "Panel A"
    subject["value"] = customer.clerk_subject
    assert database_client.get(customer_history).json()["total"] == 2
    declined = database_client.post(
        f"{customer_history}/{replacement.json()['revision_id']}/decline"
    )
    assert declined.status_code == 200
    assert declined.json()["status"] == "declined"
    subject["value"] = staff_a.clerk_subject
    assert database_client.post(revisions_path).status_code == 409
    assert (
        database_client.post(
            f"{revisions_path}/{replacement.json()['revision_id']}/withdraw"
        ).status_code
        == 409
    )
    subject["value"] = customer.clerk_subject
    assert (
        database_client.post(
            f"{customer_history}/{replacement.json()['revision_id']}/decline"
        ).status_code
        == 409
    )
    assert database_client.get(customer_history).json()["total"] == 2

    subject["value"] = staff_b.clerk_subject
    own_b_path = f"/companies/{company_b.id}/request-deliveries/{delivery_b.id}/quotations"
    created_b = database_client.post(own_b_path)
    assert created_b.status_code == 201
    terms_b = {
        "lines": [
            {
                "kind": "charge",
                "description": "Installation",
                "quantity": "1",
                "unit_price": "100.00",
            }
        ],
        "capacity_kwp": "1.000",
        "warranty_terms": "One year",
        "exclusions": "Roof repairs excluded",
        "validity_days": 30,
    }
    assert (
        database_client.put(
            f"{own_b_path}/{created_b.json()['id']}/draft", json=terms_b
        ).status_code
        == 200
    )
    assert database_client.post(f"{own_b_path}/{created_b.json()['id']}/send").status_code == 200
    b_history = f"{own_b_path}/{created_b.json()['id']}/revisions"
    b_revision_id = created_b.json()["revision_id"]
    withdrawn = database_client.post(f"{b_history}/{b_revision_id}/withdraw")
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    assert database_client.post(f"{b_history}/{b_revision_id}/withdraw").status_code == 409
    assert database_client.get(b_history).json()["total"] == 1
    subject["value"] = customer.clerk_subject
    b_customer_history = (
        f"/users/me/requests/{request.id}/quotations/{created_b.json()['id']}/revisions"
    )
    assert database_client.get(b_customer_history).json()["items"][0]["status"] == "withdrawn"
    subject["value"] = staff_a.clerk_subject
    assert database_client.get(b_history).status_code == 403
