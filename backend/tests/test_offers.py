"""Offer management requires active membership in the exact company."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def offers(database_client, database_connection, database_session):
    schema = f"offers_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, Product, CompanyMembership, ProductOffer):
        model.__table__.create(database_connection)
    user = AppUser(clerk_subject="user_offer_staff")
    company_a, company_b = Company(name="Company A"), Company(name="Company B")
    product = Product(kind="panel", brand="Test brand", model="Test panel")
    database_session.add_all([user, company_a, company_b, product])
    database_session.flush()
    membership = CompanyMembership(user_id=user.id, company_id=company_a.id, role="sales")
    other_offer = ProductOffer(
        company_id=company_b.id, product_id=product.id, indicative_price=999, currency="LKR"
    )
    database_session.add_all([membership, other_offer])
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_offer_staff", "session_test"
    )
    return (
        database_client,
        database_session,
        user,
        membership,
        company_a.id,
        company_b.id,
        product.id,
        other_offer.id,
    )


def test_staff_manage_own_offer_only(offers):
    client, session, user, membership, own, foreign, product, other_offer = offers
    body = {
        "product_id": str(product),
        "indicative_price": "1250.00",
        "currency": "LKR",
        "company_claim": "Company-declared support",
        "is_demo_price": True,
    }
    assert client.post(f"/companies/{foreign}/offers", json=body).status_code == 403
    created = client.post(f"/companies/{own}/offers", json=body)
    assert created.status_code == 201
    offer_id = created.json()["id"]
    assert created.json()["company_id"] == str(own)
    assert created.json()["claim_label"] == "company_declared"
    assert client.post(f"/companies/{own}/offers", json=body).status_code == 409
    assert len(client.get(f"/companies/{own}/offers").json()) == 1
    assert client.get(f"/companies/{foreign}/offers").status_code == 403
    assert (
        client.patch(
            f"/companies/{foreign}/offers/{other_offer}",
            json={"indicative_price": "1", "currency": "LKR"},
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/companies/{own}/offers/{other_offer}", json={"company_claim": "Forged"}
        ).status_code
        == 404
    )
    changed = client.patch(
        f"/companies/{own}/offers/{offer_id}", json={"indicative_price": None, "currency": None}
    )
    assert changed.status_code == 200
    assert changed.json()["indicative_price"] is None
    assert changed.json()["currency"] is None
    session.expire_all()
    assert session.get(ProductOffer, other_offer).indicative_price == 999
    assert session.get(Product, product).model == "Test panel"


@pytest.mark.parametrize(
    "role,status,expected",
    [
        ("company_admin", "active", 201),
        ("sales", "active", 201),
        ("technician", "active", 403),
        ("sales", "suspended", 403),
    ],
)
def test_assignment_permissions(offers, role, status, expected):
    client, session, user, membership, own, foreign, product, _ = offers
    membership.role = role
    membership.status = status
    session.commit()
    response = client.post(f"/companies/{own}/offers", json={"product_id": str(product)})
    assert response.status_code == expected


def test_invalid_offer_input_and_archived_product(offers):
    client, session, user, membership, own, _, product, _ = offers
    for body in (
        {"product_id": str(product), "indicative_price": "10"},
        {"product_id": str(product), "currency": "LKR"},
        {"product_id": str(product), "indicative_price": "-1", "currency": "LKR"},
        {"product_id": str(product), "company_claim": "x", "brand": "Forged"},
        {"product_id": str(product), "indicative_price": "10", "currency": "lkr"},
    ):
        assert client.post(f"/companies/{own}/offers", json=body).status_code == 422
    item = session.get(Product, product)
    item.is_archived = True
    session.commit()
    assert (
        client.post(f"/companies/{own}/offers", json={"product_id": str(product)}).status_code
        == 404
    )
    assert session.scalar(select(ProductOffer).where(ProductOffer.company_id == own)) is None
