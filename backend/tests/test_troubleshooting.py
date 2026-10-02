"""Troubleshooting is sourced and exact: another model's instructions never stand in."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.product import Product
from app.models.troubleshooting import TroubleshootingReference
from app.models.user import AppUser

pytestmark = pytest.mark.database

SOURCE = {
    "source_title": "Fictional installation manual",
    "source_url": "https://example.org/manual.pdf",
    "source_page": "42",
    "verified_on": "2026-09-28",
}


def reference(product, **over):
    return {
        "product_id": str(product.id),
        "code": "E01",
        "title": "Grid voltage out of range",
        "steps": ["Note the display code", "Photograph the display"],
        "safety_level": "safe_observation",
        **SOURCE,
        **over,
    }


def test_exact_model_lookup(database_client, database_session):
    client, session = database_client, database_session
    admin = AppUser(clerk_subject="ts_admin", role="platform_admin")
    customer = AppUser(clerk_subject="ts_customer")
    a = Product(kind="inverter", brand="Fictiv", model="INV-5000")
    b = Product(kind="inverter", brand="Fictiv", model="INV-5000-PRO")  # a similar model
    c = Product(kind="inverter", brand="Other", model="INV-5000")  # same model name, other brand
    d = Product(kind="inverter", brand="Archived", model="OLD-1", is_archived=True)
    session.add_all([admin, customer, a, b, c, d])
    session.commit()

    def act_as(subject: str | None) -> None:
        if subject is None:
            client.app.dependency_overrides.pop(require_identity, None)
        else:
            client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
                subject, "session_test"
            )

    base = "/admin/troubleshooting"
    # Authoring is for platform administrators only.
    act_as("ts_customer")
    assert client.post(base, json=reference(a)).status_code == 403
    assert client.get(base).status_code == 403
    act_as("ts_admin")

    # Creation rules: a hazard needs its warning, a real source address, and bounded steps.
    assert client.post(base, json=reference(a, safety_level="hazard")).status_code == 409
    assert client.post(base, json=reference(a, source_url="not a url")).status_code == 422
    assert client.post(base, json=reference(a, steps=[])).status_code == 422
    assert client.post(base, json=reference(a, steps=["  "])).status_code == 422
    assert client.post(base, json=reference(a, product_id=str(uuid4()))).status_code == 404
    assert client.post(base, json=reference(d)).status_code == 404

    draft = client.post(base, json=reference(a)).json()
    assert draft["status"] == "draft" and draft["is_sample"] is True
    hazard = client.post(
        base,
        json=reference(
            a,
            code="E09",
            title="Burning smell",
            safety_level="hazard",
            hazard_warning="Switch off at the isolator and call a qualified technician.",
        ),
    ).json()
    other_model = client.post(base, json=reference(b, code="E01", title="PRO only")).json()
    unverified = client.post(base, json=reference(a, code="E22", verified_on=None)).json()

    # Drafts are invisible to the public.
    act_as(None)
    lookup = "/troubleshooting"
    assert client.get(lookup, params={"product_id": str(a.id)}).json()["references"] == []

    act_as("ts_admin")
    assert client.post(f"{base}/{unverified['id']}/publish").status_code == 409  # never checked
    for item in (draft, hazard, other_model):
        assert client.post(f"{base}/{item['id']}/publish").status_code == 200
    assert client.post(f"{base}/{draft['id']}/publish").status_code == 409  # already published
    assert client.put(f"{base}/{draft['id']}", json=reference(a)).status_code == 409  # frozen

    # Exact model: only its own references, hazards first, with the source on every one.
    act_as(None)
    found = client.get(lookup, params={"model": "inv-5000", "code": ""}).json()
    assert found["match"] == "ambiguous"  # two brands use the name: nothing is shown
    assert found["references"] == [] and len(found["suggestions"]) == 2
    exact = client.get(lookup, params={"model": "Fictiv INV-5000"}).json()
    assert exact["match"] == "exact" and exact["product"]["id"] == str(a.id)
    assert [r["code"] for r in exact["references"]] == ["E09", "E01"]
    assert exact["references"][0]["safety_level"] == "hazard"
    assert exact["references"][0]["hazard_warning"].startswith("Switch off")
    assert all(r["product_id"] == str(a.id) and r["source_url"] for r in exact["references"])
    assert "PRO only" not in str(exact)

    # A code narrows it, case-insensitively, and a missing code is said so, not filled in.
    narrowed = client.get(lookup, params={"product_id": str(a.id), "code": "e01"}).json()
    assert [r["code"] for r in narrowed["references"]] == ["E01"]
    nothing = client.get(lookup, params={"product_id": str(a.id), "code": "E99"}).json()
    assert nothing["references"] == [] and "and code" in nothing["notice"]

    # A similar or unknown model gets no instructions, only names to pick from.
    near = client.get(lookup, params={"model": "INV-500"}).json()
    assert near["match"] == "none" and near["references"] == [] and near["product"] is None
    assert {s["model"] for s in near["suggestions"]} == {"INV-5000", "INV-5000-PRO"}
    assert "different model" in near["notice"]
    pro = client.get(lookup, params={"model": "INV-5000-PRO"}).json()
    assert [r["title"] for r in pro["references"]] == ["PRO only"]
    # The product that has no reference of its own is not given its neighbour's.
    assert client.get(lookup, params={"product_id": str(c.id)}).json()["references"] == []
    # Archived products cannot be looked up; the inputs are checked.
    assert client.get(lookup, params={"product_id": str(d.id)}).status_code == 404
    assert client.get(lookup).status_code == 422
    assert client.get(lookup, params={"model": "x", "product_id": str(a.id)}).status_code == 422

    # Archiving withdraws a reference at once.
    act_as("ts_admin")
    assert client.post(f"{base}/{hazard['id']}/archive").status_code == 200
    assert client.post(f"{base}/{hazard['id']}/archive").status_code == 409
    act_as(None)
    assert [
        r["code"] for r in client.get(lookup, params={"product_id": str(a.id)}).json()["references"]
    ] == ["E01"]

    # The database holds the rules even for a direct write.
    session.execute(text("SAVEPOINT s"))
    with pytest.raises(Exception, match="ck_troubleshooting_published_sourced"):
        session.execute(
            text("UPDATE troubleshooting_references SET verified_on = NULL WHERE id = :i"),
            {"i": draft["id"]},
        )
    session.execute(text("ROLLBACK TO SAVEPOINT s"))
    assert len(session.scalars(select(TroubleshootingReference)).all()) == 4
