"""Public catalogue pagination, stable IDs, and archived-product exclusion."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product

pytestmark = pytest.mark.database


@pytest.fixture
def catalogue(database_client, database_connection, database_session):
    schema = f"catalogue_public_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (Product, Panel, Inverter):
        model.__table__.create(database_connection)
    products = [
        Product(kind="panel", brand="Alpha", model="P1"),
        Product(kind="panel", brand="Alpha", model="P2"),
        Product(kind="panel", brand="Alpha", model="P3", is_archived=True),
        Product(kind="inverter", brand="Beta", model="I1"),
    ]
    database_session.add_all(products)
    database_session.flush()
    database_session.add_all(
        [
            Panel(product_id=products[0].id, wattage_w=400),
            Panel(product_id=products[1].id),
            Panel(product_id=products[2].id),
            Inverter(product_id=products[3].id, category="hybrid"),
        ]
    )
    database_session.commit()
    return database_client, [product.id for product in products]


def test_bounded_lists_and_stable_details(catalogue):
    client, ids = catalogue
    first = client.get("/catalogue/panels?limit=1&offset=0")
    assert first.status_code == 200
    assert first.json()["total"] == 2
    assert [item["id"] for item in first.json()["items"]] == [str(ids[0])]
    second = client.get("/catalogue/panels?limit=1&offset=1").json()
    assert [item["id"] for item in second["items"]] == [str(ids[1])]
    assert client.get("/catalogue/panels?limit=1&offset=0").json() == first.json()
    detail = client.get(f"/catalogue/panels/{ids[0]}")
    assert detail.status_code == 200
    assert detail.json()["id"] == str(ids[0])
    assert detail.json()["specifications"]["wattage_w"] == "400.000"
    assert detail.headers["cache-control"] == "no-store"
    inverter = client.get(f"/catalogue/inverters/{ids[3]}")
    assert inverter.status_code == 200
    assert inverter.json()["specifications"]["category"] == "hybrid"
    assert client.get("/catalogue/inverters").json()["total"] == 1


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "offset=10001"])
def test_pagination_rejects_out_of_bounds(catalogue, query):
    client, _ = catalogue
    assert client.get(f"/catalogue/panels?{query}").status_code == 422


def test_archived_and_wrong_kind_not_public(catalogue):
    client, ids = catalogue
    assert client.get("/catalogue/panels").json()["total"] == 2
    assert client.get(f"/catalogue/panels/{ids[2]}").status_code == 404
    assert client.get(f"/catalogue/panels/{ids[3]}").status_code == 404
    assert client.get(f"/catalogue/inverters/{ids[0]}").status_code == 404
    assert client.get(f"/catalogue/panels/{uuid4()}").status_code == 404
