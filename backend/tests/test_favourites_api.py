"""Favourites persist per customer, are bounded, and the id lookup matches the visible list."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.api.routes.favourites import MAX_FAVOURITES
from app.core.auth import VerifiedIdentity, require_identity
from app.models.favourite import Favourite
from app.models.product import Product
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def world(database_client, database_session):
    first = AppUser(clerk_subject="fav_first")
    second = AppUser(clerk_subject="fav_second")
    admin = AppUser(clerk_subject="fav_admin", role="platform_admin")
    products = [
        Product(kind="panel", brand="Fav", model=f"P{i:03d}") for i in range(MAX_FAVOURITES + 5)
    ]
    database_session.add_all([first, second, admin, *products])
    database_session.commit()

    def act_as(subject: str) -> None:
        database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "fav_session"
        )

    act_as("fav_first")
    return database_client, database_session, act_as, first, second, products


def ids(client):
    response = client.get("/users/me/favourites/ids")
    assert response.status_code == 200, response.json()
    assert response.headers["cache-control"] == "no-store"
    return response.json()


def test_ids_lists_my_published_favourites_newest_first_with_the_limit(world):
    client, session, act_as, first, second, products = world
    assert ids(client) == {"product_ids": [], "max_favourites": MAX_FAVOURITES}
    # Distinct timestamps: requests in production each have their own transaction.
    start = datetime(2026, 1, 1, tzinfo=UTC)
    session.add_all(
        Favourite(user_id=first.id, product_id=product.id, created_at=start + timedelta(minutes=i))
        for i, product in enumerate(products[:3])
    )
    session.commit()
    assert ids(client)["product_ids"] == [str(p.id) for p in reversed(products[:3])]
    # The paged list and the id lookup agree on what counts and in what order.
    listed = client.get("/users/me/favourites").json()
    assert [item["id"] for item in listed["items"]] == ids(client)["product_ids"]
    assert listed["total"] == 3
    # A favourite added through the API shows up too.
    assert client.put(f"/users/me/favourites/{products[3].id}").status_code == 204
    assert set(ids(client)["product_ids"]) == {str(p.id) for p in products[:4]}


def test_favourites_belong_to_one_customer(world):
    client, session, act_as, first, second, products = world
    client.put(f"/users/me/favourites/{products[0].id}")
    act_as("fav_second")
    assert ids(client)["product_ids"] == []
    assert client.put(f"/users/me/favourites/{products[1].id}").status_code == 204
    act_as("fav_first")
    assert ids(client)["product_ids"] == [str(products[0].id)]
    assert (
        client.delete(f"/users/me/favourites/{products[1].id}").status_code == 204
    )  # not mine: no effect
    act_as("fav_second")
    assert ids(client)["product_ids"] == [str(products[1].id)]


def test_adding_and_removing_are_idempotent_and_persist(world):
    client, session, act_as, first, second, products = world
    for _ in range(3):
        assert client.put(f"/users/me/favourites/{products[0].id}").status_code == 204
    assert session.scalar(select(func.count()).select_from(Favourite)) == 1
    for _ in range(3):
        assert client.delete(f"/users/me/favourites/{products[0].id}").status_code == 204
    assert ids(client)["product_ids"] == []


def test_the_limit_stops_an_extra_favourite_but_allows_repeats_and_room_made(world):
    client, session, act_as, first, second, products = world
    session.add_all(Favourite(user_id=first.id, product_id=p.id) for p in products[:MAX_FAVOURITES])
    session.commit()
    assert len(ids(client)["product_ids"]) == MAX_FAVOURITES
    refused = client.put(f"/users/me/favourites/{products[MAX_FAVOURITES].id}")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "conflict"
    assert f"up to {MAX_FAVOURITES} favourites" in refused.json()["error"]["message"]
    assert session.scalar(select(func.count()).select_from(Favourite)) == MAX_FAVOURITES
    # Saving something already saved is not a new favourite, so it is still fine at the limit.
    assert client.put(f"/users/me/favourites/{products[0].id}").status_code == 204
    # Removing one makes room again.
    assert client.delete(f"/users/me/favourites/{products[0].id}").status_code == 204
    assert client.put(f"/users/me/favourites/{products[MAX_FAVOURITES].id}").status_code == 204
    # The limit is per customer.
    act_as("fav_second")
    assert client.put(f"/users/me/favourites/{products[0].id}").status_code == 204


def test_archived_products_are_hidden_and_do_not_use_up_the_limit(world):
    client, session, act_as, first, second, products = world
    session.add_all(Favourite(user_id=first.id, product_id=p.id) for p in products[:MAX_FAVOURITES])
    for product in products[:5]:
        product.is_archived = True
    session.commit()
    assert len(ids(client)["product_ids"]) == MAX_FAVOURITES - 5
    assert client.get("/users/me/favourites").json()["total"] == MAX_FAVOURITES - 5
    assert client.put(f"/users/me/favourites/{products[MAX_FAVOURITES].id}").status_code == 204
    assert client.put(f"/users/me/favourites/{products[0].id}").status_code == 404  # archived


def test_only_customers_may_look_up_favourites(world):
    client, session, act_as, first, second, products = world
    act_as("fav_admin")
    assert client.get("/users/me/favourites/ids").status_code == 403
    assert client.put(f"/users/me/favourites/{products[0].id}").status_code == 403
    client.app.dependency_overrides.pop(require_identity)
    assert client.get("/users/me/favourites/ids").status_code == 401
