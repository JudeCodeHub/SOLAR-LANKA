"""Support cases belong to their customer and reach only the company that installed the system."""

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.api.routes.installations import _evidence_storage
from app.core.auth import VerifiedIdentity, require_identity
from app.core.private_storage import LocalPrivateStorage
from app.models.company import CompanyMembership
from app.models.product import Product
from app.models.support_case import SupportCase
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")  # Moonleaf's, for the demo customer
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_support_cases(database_client, database_session, tmp_path):
    client, session = database_client, database_session
    client.app.dependency_overrides[_evidence_storage] = lambda: LocalPrivateStorage(
        tmp_path / "private", environment="test"
    )
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="sc_tech")
    stranger = AppUser(clerk_subject="sc_stranger")
    inverter = Product(kind="inverter", brand="Fictiv", model="INV-1")
    retired = Product(kind="panel", brand="Old", model="P-0", is_archived=True)
    session.add_all([tech, stranger, inverter, retired])
    session.flush()
    session.add(CompanyMembership(user_id=tech.id, company_id=MOONLEAF, role="technician"))
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    base = "/users/me/support-cases"
    act_as(CUSTOMER)

    # Inputs: a symptom is required; the installation must be theirs; the equipment must exist.
    ok = {"installation_id": str(INSTALLATION), "symptom": "  Display shows a fault  "}
    assert client.post(base, json={**ok, "symptom": "  "}).status_code == 422
    assert client.post(base, json={**ok, "extra": 1}).status_code == 422
    assert client.post(base, json={**ok, "installation_id": str(uuid4())}).status_code == 404
    assert client.post(base, json={**ok, "product_id": str(uuid4())}).status_code == 404
    assert client.post(base, json={**ok, "product_id": str(retired.id)}).status_code == 404
    act_as("sc_stranger")
    assert client.post(base, json=ok).status_code == 404  # someone else's installation
    act_as(CUSTOMER)
    assert client.get(base).json() == []

    made = client.post(
        base,
        json={**ok, "product_id": str(inverter.id), "observed_code": " E01 ", "unsafe_now": True},
    )
    assert made.status_code == 201
    case = made.json()
    assert case["symptom"] == "Display shows a fault" and case["observed_code"] == "E01"
    assert case["status"] == "open" and case["equipment"]["model"] == "INV-1"
    assert "do not touch" in case["safety_notice"]
    calm = client.post(base, json=ok).json()
    assert calm["safety_notice"] is None and calm["equipment"] is None
    stored = session.scalars(select(SupportCase).where(SupportCase.id == case["id"])).one()
    assert stored.company_id == MOONLEAF  # the installing company, chosen by the server

    # Private photos: images only, bounded, owner only.
    cid = case["id"]
    up = client.post(f"{base}/{cid}/attachments", files={"file": ("a.png", PNG, "image/png")})
    assert up.status_code == 201
    asset = up.json()["asset_id"]
    assert (
        client.post(
            f"{base}/{cid}/attachments", files={"file": ("a.png", b"not an image", "image/png")}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{base}/{cid}/attachments", files={"file": ("a.pdf", b"%PDF-1", "application/pdf")}
        ).status_code
        == 422
    )
    for _ in range(4):
        assert (
            client.post(
                f"{base}/{cid}/attachments", files={"file": ("a.png", PNG, "image/png")}
            ).status_code
            == 201
        )
    assert (
        client.post(
            f"{base}/{cid}/attachments", files={"file": ("a.png", PNG, "image/png")}
        ).status_code
        == 409
    )
    got = client.get(f"{base}/{cid}/attachments/{asset}")
    assert (
        got.status_code == 200 and got.content == PNG and got.headers["cache-control"] == "no-store"
    )
    assert client.get(f"{base}/{cid}/attachments/{uuid4()}").status_code == 404
    assert len(client.get(f"{base}/{cid}").json()["attachments"]) == 5

    # Ownership: nobody else can read the case, list it, attach to it or fetch its photo.
    act_as("sc_stranger")
    assert client.get(base).json() == []
    for path in (f"{base}/{cid}", f"{base}/{cid}/attachments/{asset}"):
        assert client.get(path).status_code == 404
    assert (
        client.post(
            f"{base}/{cid}/attachments", files={"file": ("a.png", PNG, "image/png")}
        ).status_code
        == 404
    )

    # Company scope: only the installing company's administrators and sales.
    theirs = f"/companies/{MOONLEAF}/support-cases"
    act_as(STAFF_B)
    listing = client.get(theirs).json()
    assert [c["id"] for c in listing][0] == cid  # a reported danger is listed first
    assert {c["id"] for c in listing} == {cid, calm["id"]}
    assert client.get(f"{theirs}/{cid}").json()["symptom"] == "Display shows a fault"
    assert client.get(f"{theirs}/{cid}/attachments/{asset}").content == PNG
    assert "customer_id" not in str(client.get(f"{theirs}/{cid}").json())
    for subject in (STAFF_A, "sc_tech", CUSTOMER):
        act_as(subject)
        assert client.get(theirs).status_code == 403, subject
    act_as(STAFF_A)  # another company asking through its own path sees nothing of this case
    own = f"/companies/{DEMO_COMPANIES[0][0]}/support-cases"
    assert client.get(own).json() == []
    assert client.get(f"{own}/{cid}").status_code == 404
    assert client.get(f"{own}/{cid}/attachments/{asset}").status_code == 404

    # A finished case takes no more photos, and the open-case limit is enforced.
    stored.status = "closed"
    session.commit()
    act_as(CUSTOMER)
    assert (
        client.post(
            f"{base}/{cid}/attachments", files={"file": ("a.png", PNG, "image/png")}
        ).status_code
        == 409
    )
    for _ in range(9):
        assert client.post(base, json=ok).status_code == 201
    assert client.post(base, json=ok).status_code == 409
    act_as("someone_new")
    assert client.get(base).json() == []
