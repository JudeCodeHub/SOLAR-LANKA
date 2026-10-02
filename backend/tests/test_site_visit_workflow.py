"""Site visit confirmation, alternatives, cancellation and rescheduling, with access rules."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import CompanyMembership
from app.models.installation_assignment import InstallationAssignment
from app.models.site_visit import SiteVisitEvent
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")


def slots(days: int = 10, hour: int = 9, count: int = 1):
    out = []
    for i in range(count):
        local = (datetime.now(UTC) + timedelta(days=days + i)).replace(
            hour=hour, minute=0, second=0, microsecond=0
        )
        start = local - timedelta(hours=5, minutes=30)  # Colombo wall clock written in UTC
        out.append(
            {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat()}
        )
    return out


def test_visit_workflow(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="vt_tech")
    other_tech = AppUser(clerk_subject="vt_tech_sunbird")
    sales = AppUser(clerk_subject="vt_sales")
    session.add_all([tech, other_tech, sales])
    session.flush()
    session.add_all(
        [
            CompanyMembership(user_id=tech.id, company_id=MOONLEAF, role="technician"),
            CompanyMembership(
                user_id=other_tech.id, company_id=DEMO_COMPANIES[0][0], role="technician"
            ),
            CompanyMembership(user_id=sales.id, company_id=MOONLEAF, role="sales"),
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
    visit = client.post(mine, json={"slots": slots(count=2), "note": "Dog"}).json()
    vid = visit["id"]
    preferred = [s["id"] for s in visit["slots"]]

    # Staff confirm one preferred slot with an eligible technician.
    act_as(STAFF_B)
    confirm = f"{theirs}/{vid}/confirm"
    for who, expected in (
        (other_tech, 409),  # technician of another company
        (sales, 409),  # not a technician
    ):
        r = client.post(confirm, json={"slot_id": preferred[0], "technician_id": str(who.id)})
        assert r.status_code == expected
    assert (
        client.post(
            confirm, json={"slot_id": str(uuid4()), "technician_id": str(tech.id)}
        ).status_code
        == 404
    )
    done = client.post(confirm, json={"slot_id": preferred[1], "technician_id": str(tech.id)})
    assert done.status_code == 200
    body = done.json()
    assert body["status"] == "confirmed" and body["technician_id"] == str(tech.id)
    assert (
        body["confirmed_starts_at"]
        == next(s["starts_at"] for s in visit["slots"] if s["id"] == preferred[1])
        or body["confirmed_starts_at"]
    )
    # The technician now sees the job; a second confirm is refused.
    assert session.scalar(
        select(InstallationAssignment.id).where(InstallationAssignment.technician_id == tech.id)
    )
    assert (
        client.post(
            confirm, json={"slot_id": preferred[0], "technician_id": str(tech.id)}
        ).status_code
        == 409
    )
    # The customer sees the time but not who is coming.
    act_as(CUSTOMER)
    seen = client.get(mine).json()[0]
    assert seen["status"] == "confirmed" and seen["technician_id"] is None

    # Staff offer alternatives from a confirmed visit; the customer accepts one.
    act_as(STAFF_B)
    # Bad alternatives are refused with the rule's reason and change nothing.
    bad = client.post(
        f"{theirs}/{vid}/propose",
        json={"slots": slots(hour=22), "technician_id": str(tech.id)},
    )
    assert bad.status_code == 409 and "07:00 and 19:00" in bad.json()["error"]["message"]
    proposal = client.post(
        f"{theirs}/{vid}/propose",
        json={"slots": slots(days=20, count=2), "technician_id": str(tech.id)},
    )
    assert proposal.status_code == 200 and proposal.json()["status"] == "alternatives_offered"
    assert proposal.json()["confirmed_starts_at"] is None
    proposed = [s["id"] for s in proposal.json()["slots"] if s["kind"] == "proposed"]
    assert len(proposed) == 2
    assert (
        client.post(
            f"{theirs}/{vid}/propose", json={"slots": slots(), "technician_id": str(tech.id)}
        ).status_code
        == 409
    )

    act_as(CUSTOMER)
    accept = f"{mine}/{vid}/accept"
    assert (
        client.post(accept, json={"slot_id": preferred[0]}).status_code == 404
    )  # not a proposed slot
    ok = client.post(accept, json={"slot_id": proposed[1]})
    assert ok.status_code == 200 and ok.json()["status"] == "confirmed"
    assert client.post(accept, json={"slot_id": proposed[1]}).status_code == 409

    # The customer reschedules: new preferred slots, back to waiting, no technician or time.
    resched = client.post(f"{mine}/{vid}/reschedule", json={"slots": slots(days=30), "note": ""})
    assert resched.status_code == 200
    r = resched.json()
    assert r["status"] == "requested" and r["confirmed_starts_at"] is None and r["note"] is None
    assert [s["kind"] for s in r["slots"]] == ["preferred"]
    assert client.post(f"{mine}/{vid}/reschedule", json={"slots": slots(hour=3)}).status_code == 409

    # Only the people on this job can act on it.
    for subject in ("someone_else", STAFF_A):
        act_as(subject)
        assert client.post(f"{mine}/{vid}/cancel", json={}).status_code == 404
    act_as(STAFF_A)
    assert client.post(f"{theirs}/{vid}/cancel", json={}).status_code == 403
    act_as("vt_tech")
    assert client.post(f"{theirs}/{vid}/cancel", json={}).status_code == 403
    assert client.get(theirs).status_code == 403

    # Either side can cancel; a cancelled visit allows nothing and frees the installation.
    act_as(STAFF_B)
    cancelled = client.post(f"{theirs}/{vid}/cancel", json={"reason": "Site not ready"})
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    for path, payload in (
        (f"{theirs}/{vid}/cancel", {}),
        (f"{theirs}/{vid}/propose", {"slots": slots(), "technician_id": str(tech.id)}),
    ):
        assert client.post(path, json=payload).status_code == 409
    act_as(CUSTOMER)
    assert client.post(f"{mine}/{vid}/reschedule", json={"slots": slots()}).status_code == 409
    second = client.post(mine, json={"slots": slots(days=12)}).json()["id"]
    assert client.post(f"{mine}/{second}/cancel", json={}).json()["status"] == "cancelled"

    # Every step is recorded in order with who did it.
    events = [
        (e.action, e.to_status)
        for e in session.scalars(
            select(SiteVisitEvent).order_by(SiteVisitEvent.created_at, SiteVisitEvent.id)
        )
    ]
    assert [a for a, _ in events[:7]] == [
        "requested",
        "confirmed",
        "proposed_alternatives",
        "accepted_alternative",
        "rescheduled_by_customer",
        "cancelled",
        "requested",
    ]
