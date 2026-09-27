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


def test_search_brand_model_and_filters(catalogue):
    client, ids = catalogue
    assert client.get("/catalogue/panels?search=alpha").json()["total"] == 2
    assert client.get("/catalogue/panels?search=p1").json()["items"][0]["id"] == str(ids[0])
    assert client.get("/catalogue/panels?search=%25").json()["total"] == 0
    assert client.get("/catalogue/panels?min_wattage_w=400").json()["total"] == 1
    assert client.get("/catalogue/panels?max_wattage_w=399").json()["total"] == 0
    assert client.get("/catalogue/panels?min_efficiency_percent=20").json()["total"] == 0
    assert client.get("/catalogue/inverters?search=beta&category=hybrid").json()["total"] == 1
    assert client.get("/catalogue/inverters?category=on_grid").json()["total"] == 0
    assert client.get("/catalogue/inverters?min_capacity_kw=5").json()["total"] == 0
    filtered = client.get("/catalogue/panels?min_wattage_w=400&limit=1&offset=1").json()
    assert filtered["items"] == [] and filtered["total"] == 1


@pytest.mark.parametrize(
    "path",
    [
        "/catalogue/panels?min_wattage_w=500&max_wattage_w=400",
        "/catalogue/panels?min_wattage_w=-1",
        "/catalogue/panels?min_efficiency_percent=101",
        "/catalogue/inverters?category=wrong",
        "/catalogue/inverters?min_capacity_kw=5&max_capacity_kw=4",
        "/catalogue/inverters?min_capacity_kw=0",
    ],
)
def test_invalid_specification_filters(catalogue, path):
    client, _ = catalogue
    assert client.get(path).status_code == 422


def test_numeric_filters_match_known_specs(catalogue, database_session):
    client, ids = catalogue
    panel = database_session.get(Panel, ids[0])
    inverter = database_session.get(Inverter, ids[3])
    panel.efficiency_percent = 21
    inverter.capacity_kw = 5
    database_session.commit()
    assert client.get("/catalogue/panels?min_efficiency_percent=20").json()["total"] == 1
    assert client.get("/catalogue/panels?min_efficiency_percent=22").json()["total"] == 0
    assert (
        client.get("/catalogue/inverters?min_capacity_kw=4&max_capacity_kw=6").json()["total"] == 1
    )
    assert client.get("/catalogue/inverters?max_capacity_kw=4").json()["total"] == 0
