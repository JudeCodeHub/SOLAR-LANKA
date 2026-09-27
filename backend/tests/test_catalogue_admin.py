"""Canonical specifications cannot be changed by company staff."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def catalogue(database_client, database_connection, database_session):
    schema = f"catalogue_admin_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Product, Panel, Inverter):
        model.__table__.create(database_connection)
    staff = AppUser(clerk_subject="user_company_staff")
    panel_product = Product(kind="panel", brand="Fictional", model="Panel")
    inverter_product = Product(kind="inverter", brand="Fictional", model="Inverter")
    database_session.add_all([staff, panel_product, inverter_product])
    database_session.flush()
    database_session.add_all(
        [
            Panel(product_id=panel_product.id, wattage_w=400),
            Inverter(product_id=inverter_product.id),
        ]
    )
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_company_staff", "session_test"
    )
    return database_client, database_session, staff, panel_product.id, inverter_product.id


def test_staff_cannot_edit_or_archive(catalogue):
    client, session, user, panel_id, inverter_id = catalogue
    for path, body in (
        (f"/{panel_id}", {"brand": "Forged"}),
        (f"/{panel_id}/panel", {"wattage_w": "900"}),
        (f"/{inverter_id}/inverter", {"capacity_kw": "8"}),
    ):
        assert client.patch("/admin/products" + path, json=body).status_code == 403
    assert client.post(f"/admin/products/{panel_id}/archive").status_code == 403
    session.refresh(session.get(Panel, panel_id))
    assert session.get(Panel, panel_id).wattage_w == 400
    assert session.get(Product, panel_id).is_archived is False


def test_platform_admin_can_edit_and_archive(catalogue):
    client, session, user, panel_id, inverter_id = catalogue
    user.role = "platform_admin"
    session.commit()
    assert (
        client.patch(f"/admin/products/{panel_id}", json={"brand": "Reviewed"}).status_code == 200
    )
    assert (
        client.patch(f"/admin/products/{panel_id}/panel", json={"wattage_w": "450"}).status_code
        == 200
    )
    assert (
        client.patch(
            f"/admin/products/{inverter_id}/inverter",
            json={
                "category": "hybrid",
                "capacity_kw": "5",
                "compatibility_notes": "Supported",
                "compatibility_source_url": "https://example.invalid/manual",
            },
        ).status_code
        == 200
    )
    assert (
        client.patch(f"/admin/products/{panel_id}/panel", json={"capacity_kw": "10"}).status_code
        == 422
    )
    assert (
        client.patch(
            f"/admin/products/{inverter_id}/inverter", json={"compatibility_source_url": None}
        ).status_code
        == 422
    )
    assert client.post(f"/admin/products/{panel_id}/archive").status_code == 200
    assert (
        client.patch(f"/admin/products/{panel_id}/panel", json={"wattage_w": "500"}).status_code
        == 409
    )
    assert client.post(f"/admin/products/{panel_id}/archive").status_code == 409
    session.expire_all()
    assert session.get(Panel, panel_id).wattage_w == 450
    assert session.get(Product, panel_id).brand == "Reviewed"
    assert session.get(Product, panel_id).is_archived


def test_suspended_admin_denied(catalogue):
    client, session, user, panel_id, _ = catalogue
    user.role = "platform_admin"
    user.is_suspended = True
    session.commit()
    assert client.patch(f"/admin/products/{panel_id}", json={"brand": "No"}).status_code == 403
