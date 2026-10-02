"""A customer requests a visit for their own installation; their company sees it; others cannot."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.site_visit import SiteVisit
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")


def body(days: int = 10, hour: int = 9, **extra):
    colombo = timedelta(hours=5, minutes=30)
    day = (datetime.now(UTC) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    start = (day - colombo).replace(tzinfo=UTC)  # hour o'clock in Colombo, written in UTC
    return {
        "slots": [
            {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat()}
        ],
        **extra,
    }


def test_visit_requests(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    mine = f"/users/me/installations/{INSTALLATION}/site-visits"
    theirs = f"/companies/{MOONLEAF}/installations/{INSTALLATION}/site-visits"
    act_as(CUSTOMER)
    assert client.get(mine).json() == []

    # Explicit, validated inputs: each broken rule is refused with its reason and stores nothing.
    for bad, status, fragment in (
        (body(days=0, hour=10), 409, "24 hours"),
        (body(hour=22), 409, "07:00 and 19:00"),
        (body(timezone="Nowhere/Land"), 409, "Unknown time zone"),
        ({"slots": []}, 422, None),
        (body(extra_field=1), 422, None),
        (
            {"slots": [{"starts_at": "2030-01-01T09:00:00", "ends_at": "2030-01-01T11:00:00"}]},
            409,
            "UTC offset",
        ),
    ):
        refusal = client.post(mine, json=bad)
        assert refusal.status_code == status, bad
        if fragment:
            assert fragment in refusal.json()["error"]["message"]
    assert client.get(mine).json() == []

    created = client.post(mine, json=body(note="  Gate code 1234  "))
    assert created.status_code == 201
    visit = created.json()
    assert visit["status"] == "requested" and visit["timezone"] == "Asia/Colombo"
    assert visit["note"] == "Gate code 1234" and len(visit["slots"]) == 1
    # One open request at a time.
    assert client.post(mine, json=body(days=12)).status_code == 409
    assert [v["id"] for v in client.get(mine).json()] == [visit["id"]]

    # The company's staff read it; nobody else does.
    act_as(STAFF_B)
    assert [v["id"] for v in client.get(theirs).json()] == [visit["id"]]
    assert client.post(theirs, json=body()).status_code == 405
    act_as(STAFF_A)
    assert client.get(theirs).status_code == 403
    for subject in (STAFF_A, STAFF_B):
        act_as(subject)
        assert client.post(mine, json=body()).status_code == 404  # not the owning customer
    act_as("someone_new")
    assert client.get(mine).status_code == 404

    # The database enforces the same shape if something bypasses the API.
    row = session.scalars(select(SiteVisit)).one()
    session.execute(text("SAVEPOINT s"))
    with pytest.raises(Exception, match="ck_site_visits_status"):
        session.execute(
            text("UPDATE site_visits SET status = 'bogus' WHERE id = :i"), {"i": row.id}
        )
    session.execute(text("ROLLBACK TO SAVEPOINT s"))
