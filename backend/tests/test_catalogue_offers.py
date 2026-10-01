"""Public sample offers for one product: approved companies only, labelled, never invented."""

from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.company import Company
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.seed_demo import seed_demo

pytestmark = pytest.mark.database


@pytest.fixture
def seeded(database_client, database_session):
    seed_demo(database_session, environment="test")
    database_session.commit()
    return database_client, database_session


def offered_product(session, kind="panel"):
    row = session.execute(
        select(Product, ProductOffer)
        .join(ProductOffer, ProductOffer.product_id == Product.id)
        .where(Product.kind == kind)
        .order_by(Product.model)
    ).first()
    assert row is not None, "the demo seed should include offers"
    return row


def test_offers_list_approved_companies_with_clear_labels(seeded):
    client, session = seeded
    product, offer = offered_product(session)
    response = client.get(f"/catalogue/panels/{product.id}/offers")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(body["items"]) >= 1
    for item in body["items"]:
        assert item["company_name"].endswith("(Fictional)")
        assert item["claim_label"] == "company_declared"
        assert item["is_demo_price"] is True  # demo data is labelled as sample prices
        assert item["currency"] == "LKR"
    assert response.headers["cache-control"] == "no-store"
    names = [item["company_name"] for item in body["items"]]
    assert names == sorted(names)


def test_unapproved_companies_offers_are_hidden(seeded):
    client, session = seeded
    product, offer = offered_product(session)
    company = session.get(Company, offer.company_id)
    company.publication_status = "pending"
    session.commit()
    body = client.get(f"/catalogue/panels/{product.id}/offers").json()
    assert company.name not in [item["company_name"] for item in body["items"]]
    assert body["total"] == len(body["items"])


def test_missing_price_stays_null_not_zero(seeded):
    client, session = seeded
    product, offer = offered_product(session)
    offer.indicative_price = None
    offer.currency = None
    offer.company_claim = None
    session.commit()
    items = client.get(f"/catalogue/panels/{product.id}/offers").json()["items"]
    mine = next(i for i in items if i["company_id"] == str(offer.company_id))
    assert mine["indicative_price"] is None and mine["currency"] is None
    assert mine["company_claim"] is None
    offer.indicative_price = Decimal("0.00")
    offer.currency = "LKR"
    session.commit()
    items = client.get(f"/catalogue/panels/{product.id}/offers").json()["items"]
    mine = next(i for i in items if i["company_id"] == str(offer.company_id))
    assert Decimal(mine["indicative_price"]) == 0  # a real zero is reported as zero


def test_a_product_without_offers_has_an_empty_page(seeded):
    client, session = seeded
    bare = Product(kind="panel", brand="Nobody", model="Offers-None")
    session.add(bare)
    session.flush()
    from app.models.panel import Panel

    session.add(Panel(product_id=bare.id))
    session.commit()
    body = client.get(f"/catalogue/panels/{bare.id}/offers").json()
    assert body["items"] == [] and body["total"] == 0


def test_archived_unknown_and_wrong_kind_products_are_not_found(seeded):
    client, session = seeded
    product, _ = offered_product(session)
    assert client.get(f"/catalogue/inverters/{product.id}/offers").status_code == 404  # wrong kind
    assert client.get(f"/catalogue/panels/{uuid4()}/offers").status_code == 404
    product.is_archived = True
    session.commit()
    assert client.get(f"/catalogue/panels/{product.id}/offers").status_code == 404


def test_inverter_offers_and_paging_bounds(seeded):
    client, session = seeded
    product, _ = offered_product(session, "inverter")
    ok = client.get(f"/catalogue/inverters/{product.id}/offers?limit=1")
    assert ok.status_code == 200 and ok.json()["limit"] == 1
    assert client.get(f"/catalogue/inverters/{product.id}/offers?limit=0").status_code == 422
    assert client.get(f"/catalogue/inverters/{product.id}/offers?colour=red").status_code == 422
    assert client.get("/catalogue/inverters/not-a-uuid/offers").status_code == 422
