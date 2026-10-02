"""Completing a visit, working notes and private photos, with who may see what."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.api.routes.installations import _evidence_storage
from app.core.auth import VerifiedIdentity, require_identity
from app.core.private_storage import LocalPrivateStorage
from app.models.company import CompanyMembership
from app.models.site_visit import SiteVisit
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def slot():
    start = (datetime.now(UTC) + timedelta(days=10)).replace(
        hour=9, minute=0, second=0, microsecond=0
    ) - timedelta(hours=5, minutes=30)
    return {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat()}


def test_visit_work(database_client, database_session, tmp_path):
    client, session = database_client, database_session
    client.app.dependency_overrides[_evidence_storage] = lambda: LocalPrivateStorage(
        tmp_path / "private", environment="test"
    )
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="work_tech")
    stranger = AppUser(clerk_subject="work_other_tech")
    session.add_all([tech, stranger])
    session.flush()
    session.add_all(
        [
            CompanyMembership(user_id=tech.id, company_id=MOONLEAF, role="technician"),
            CompanyMembership(user_id=stranger.id, company_id=MOONLEAF, role="technician"),
        ]
    )
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    mine = f"/users/me/installations/{INSTALLATION}/site-visits"
    theirs = f"/companies/{MOONLEAF}/installations/{INSTALLATION}/site-visits"

    act_as(CUSTOMER)
    made = client.post(mine, json={"slots": [slot()], "note": "Gate code 1234"}).json()
    vid, slot_id = made["id"], made["slots"][0]["id"]
    # Nothing to do before it is confirmed.
    act_as("work_tech")
    assert client.get(f"/technician/site-visits/{vid}").status_code == 404
    assert client.get("/technician/site-visits").json() == []
    act_as(STAFF_B)
    assert (
        client.post(
            f"{theirs}/{vid}/confirm", json={"slot_id": slot_id, "technician_id": str(tech.id)}
        ).status_code
        == 200
    )

    # The booked technician sees the visit and the minimum; others do not.
    act_as("work_tech")
    listing = client.get("/technician/site-visits").json()
    assert [v["id"] for v in listing] == [vid] and listing[0]["district"] == "Colombo"
    detail = client.get(f"/technician/site-visits/{vid}").json()
    assert detail["customer_note"] == "Gate code 1234" and detail["status"] == "confirmed"
    assert str(DEMO_CUSTOMER[0]) not in str(detail)
    for subject in ("work_other_tech", CUSTOMER, STAFF_A):
        act_as(subject)
        assert client.get(f"/technician/site-visits/{vid}").status_code == 404
        assert (
            client.post(f"/technician/site-visits/{vid}/notes", json={"body": "x"}).status_code
            == 404
        )

    # Cannot complete before it has started, nor without a summary.
    act_as("work_tech")
    early = client.post(f"/technician/site-visits/{vid}/complete", json={"summary": "Done"})
    assert early.status_code == 409 and "not started" in early.json()["error"]["message"]
    assert (
        client.post(f"/technician/site-visits/{vid}/complete", json={"summary": ""}).status_code
        == 422
    )
    assert (
        client.post(f"/technician/site-visits/{vid}/complete", json={"summary": "  "}).status_code
        == 409
    )

    # The visit time arrives (written directly: the API refuses past slots by design).
    row = session.scalars(select(SiteVisit)).one()
    row.confirmed_starts_at = datetime.now(UTC) - timedelta(hours=2)
    row.confirmed_ends_at = datetime.now(UTC) - timedelta(minutes=5)
    session.commit()

    # Notes and photos: valid ones are stored, bad ones refused, limits enforced.
    assert (
        client.post(
            f"/technician/site-visits/{vid}/notes", json={"body": " Roof is steep "}
        ).status_code
        == 201
    )
    assert (
        client.post(f"/technician/site-visits/{vid}/notes", json={"body": "  "}).status_code == 409
    )
    up = client.post(
        f"/technician/site-visits/{vid}/evidence", files={"file": ("roof.png", PNG, "image/png")}
    )
    assert up.status_code == 201
    asset = up.json()["asset_id"]
    bad = client.post(
        f"/technician/site-visits/{vid}/evidence",
        files={"file": ("x.png", b"not an image", "image/png")},
    )
    assert bad.status_code == 422
    got = client.get(f"/technician/site-visits/{vid}/evidence/{asset}")
    assert got.status_code == 200 and got.content == PNG
    assert got.headers["cache-control"] == "no-store"
    assert client.get(f"/technician/site-visits/{vid}/evidence/{uuid4()}").status_code == 404
    for _ in range(9):
        assert (
            client.post(
                f"/technician/site-visits/{vid}/evidence",
                files={"file": ("r.png", PNG, "image/png")},
            ).status_code
            == 201
        )
    assert (
        client.post(
            f"/technician/site-visits/{vid}/evidence", files={"file": ("r.png", PNG, "image/png")}
        ).status_code
        == 409
    )

    # Completing records who, when and what was done.
    done = client.post(
        f"/technician/site-visits/{vid}/complete", json={"summary": " Roof surveyed "}
    )
    assert done.status_code == 200
    body = done.json()
    assert body["status"] == "completed" and body["completion_summary"] == "Roof surveyed"
    assert body["completed_by"] == str(tech.id) and body["completed_at"]
    assert body["notes"][0]["body"] == "Roof is steep" and len(body["evidence"]) == 10
    assert [h["action"] for h in body["history"]] == ["requested", "confirmed", "completed"]
    assert (
        body["history"][2]["actor_id"] == str(tech.id)
        and body["history"][2]["reason"] == "Roof surveyed"
    )
    # Finished: nothing more can be completed or cancelled, notes still allowed.
    assert (
        client.post(
            f"/technician/site-visits/{vid}/complete", json={"summary": "again"}
        ).status_code
        == 409
    )
    act_as(STAFF_B)
    assert client.post(f"{theirs}/{vid}/cancel", json={}).status_code == 409

    # Company staff read everything, including photos; other staff and the technician differ.
    work = client.get(f"{theirs}/{vid}/work")
    assert work.status_code == 200 and work.json()["completed_by"] == str(tech.id)
    assert client.get(f"{theirs}/{vid}/evidence/{asset}").content == PNG
    assert client.post(f"{theirs}/{vid}/notes", json={"body": "Invoice sent"}).status_code == 201
    act_as(STAFF_A)
    assert client.get(f"{theirs}/{vid}/work").status_code == 403
    act_as("work_tech")
    assert client.get(f"{theirs}/{vid}/work").status_code == 403

    # The customer sees the outcome but never notes, photos or names.
    act_as(CUSTOMER)
    outcome = client.get(f"{mine}/{vid}/history").json()
    assert outcome["completion_summary"] == "Roof surveyed" and outcome["status"] == "completed"
    assert outcome["notes"] == [] and outcome["evidence"] == [] and outcome["completed_by"] is None
    assert all(h["actor_id"] is None for h in outcome["history"])
    assert client.get(f"{theirs}/{vid}/evidence/{asset}").status_code == 403
    assert client.get(f"/technician/site-visits/{vid}/evidence/{asset}").status_code == 404
    act_as("someone_new")
    assert client.get(f"{mine}/{vid}/history").status_code == 404

    # The database refuses a half-completed row.
    session.execute(text("SAVEPOINT s"))
    with pytest.raises(Exception, match="ck_site_visits_completion"):
        session.execute(
            text("UPDATE site_visits SET completed_at = NULL WHERE id = :i"), {"i": vid}
        )
    session.execute(text("ROLLBACK TO SAVEPOINT s"))

    # Losing the technician role ends access to the visit.
    membership = session.scalars(
        select(CompanyMembership).where(CompanyMembership.user_id == tech.id)
    ).one()
    membership.status = "suspended"
    session.commit()
    act_as("work_tech")
    assert client.get(f"/technician/site-visits/{vid}").status_code == 404
    assert client.get("/technician/site-visits").json() == []
