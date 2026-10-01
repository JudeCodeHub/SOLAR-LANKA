"""Three-panel comparison and favourites ownership checks."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.favourite import Favourite
from app.models.inverter import Inverter
from app.models.media_asset import MediaAsset
from app.models.panel import Panel
from app.models.product import Product
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def catalogue(database_client, database_connection, database_session):
    schema = f"compare_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, MediaAsset, Product, Panel, Inverter, Favourite):
        model.__table__.create(database_connection)
    first_user = AppUser(clerk_subject="user_first")
    second_user = AppUser(clerk_subject="user_second")
    products = [Product(kind="panel", brand="Test", model=f"P{i}") for i in range(4)]
    inverter = Product(kind="inverter", brand="Test", model="I1")
    products[3].is_archived = True
    database_session.add_all([first_user, second_user, *products, inverter])
    database_session.flush()
    database_session.add_all(
        [
            Panel(product_id=products[0].id, wattage_w=400),
            Panel(product_id=products[1].id, product_warranty_years=0),
            Panel(product_id=products[2].id),
            Panel(product_id=products[3].id),
            Inverter(product_id=inverter.id),
        ]
    )
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_first", "session_first"
    )
    return (
        database_client,
        database_session,
        first_user,
        second_user,
        [p.id for p in products],
        inverter.id,
    )


def test_comparison_limits_units_and_missing_values(catalogue):
    client, _, _, _, panel_ids, inverter_id = catalogue
    ids = [str(panel_ids[i]) for i in range(3)]
    response = client.post("/catalogue/panels/compare", json={"product_ids": ids})
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["items"]] == ids
    assert body["units"]["wattage_w"] == "W"
    assert body["units"]["efficiency_percent"] == "%"
    assert body["items"][0]["specifications"]["wattage_w"] == "400.000"
    assert body["items"][1]["specifications"]["wattage_w"] is None
    assert body["items"][1]["specifications"]["product_warranty_years"] == "0.00"
    assert body["unknown_value_label"] == "Unknown"
    assert response.headers["cache-control"] == "no-store"
    for invalid in (ids[:1], ids + [str(panel_ids[3])], [ids[0], ids[0]]):
        assert (
            client.post("/catalogue/panels/compare", json={"product_ids": invalid}).status_code
            == 422
        )
    for unavailable in (panel_ids[3], inverter_id, uuid4()):
        assert (
            client.post(
                "/catalogue/panels/compare", json={"product_ids": [ids[0], str(unavailable)]}
            ).status_code
            == 404
        )


def test_favourites_are_owned_by_verified_user(catalogue):
    client, session, first, second, panel_ids, inverter_id = catalogue
    panel = panel_ids[0]
    assert client.put(f"/users/me/favourites/{panel}").status_code == 204
    assert client.put(f"/users/me/favourites/{panel}").status_code == 204
    assert client.put(f"/users/me/favourites/{panel_ids[3]}").status_code == 404
    assert client.get("/users/me/favourites").json()["total"] == 1
    assert session.scalar(select(func.count()).select_from(Favourite)) == 1
    client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_second", "session_second"
    )
    assert client.get("/users/me/favourites").json()["total"] == 0
    assert client.delete(f"/users/me/favourites/{panel}").status_code == 204
    assert client.get("/users/me/favourites").json()["total"] == 0
    client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_first", "session_first"
    )
    assert client.get("/users/me/favourites").json()["total"] == 1
    assert client.delete(f"/users/me/favourites/{panel}").status_code == 204
    assert client.get("/users/me/favourites").json()["total"] == 0
    assert client.put(f"/users/me/favourites/{inverter_id}").status_code == 204
    assert client.get("/users/me/favourites").json()["items"][0]["kind"] == "inverter"


def test_non_customer_cannot_manage_favourites(catalogue):
    client, session, first, _, panel_ids, _ = catalogue
    first.role = "platform_admin"
    session.commit()
    assert client.put(f"/users/me/favourites/{panel_ids[0]}").status_code == 403
    assert client.get("/users/me/favourites").status_code == 403
