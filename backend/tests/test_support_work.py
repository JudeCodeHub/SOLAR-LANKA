"""Assigned technicians, status history and notifications; retries and replays change nothing."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import CompanyMembership
from app.models.notification import Notification
from app.models.outbox_event import OutboxEvent
from app.models.support_case import SupportCaseUpdate
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo
from app.services.workflow_notifications import process_workflow_event

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
SUNBIRD = DEMO_COMPANIES[0][0]
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")


def test_support_work(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="sw_tech")
    tech_two = AppUser(clerk_subject="sw_tech_two")
    foreign_tech = AppUser(clerk_subject="sw_foreign_tech")
    session.add_all([tech, tech_two, foreign_tech])
    session.flush()
    session.add_all(
        [
            CompanyMembership(user_id=tech.id, company_id=MOONLEAF, role="technician"),
            CompanyMembership(user_id=tech_two.id, company_id=MOONLEAF, role="technician"),
            CompanyMembership(user_id=foreign_tech.id, company_id=SUNBIRD, role="technician"),
        ]
    )
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    def deliver() -> int:
        keys = session.scalars(
            select(OutboxEvent.event_key).where(OutboxEvent.event_type == "support.case_updated")
        ).all()
        return sum(process_workflow_event(session, key) for key in keys)

    def heard(subject: str) -> list[str]:
        user = session.scalars(select(AppUser).where(AppUser.clerk_subject == subject)).one()
        return [
            n.title
            for n in session.scalars(
                select(Notification)
                .where(
                    Notification.recipient_id == user.id, Notification.target_kind == "support_case"
                )
                .order_by(Notification.created_at, Notification.id)
            )
        ]

    act_as(CUSTOMER)
    case = client.post(
        "/users/me/support-cases",
        json={
            "installation_id": str(INSTALLATION),
            "symptom": "Inverter beeps",
            "unsafe_now": True,
        },
    ).json()
    cid = case["id"]
    mine, theirs = f"/users/me/support-cases/{cid}", f"/companies/{MOONLEAF}/support-cases/{cid}"

    # Company staff assign an eligible technician; the technician is told, once.
    act_as(STAFF_B)
    for who, expected in ((foreign_tech, 409), (uuid4(), 409)):
        user_id = str(getattr(who, "id", who))
        assert (
            client.post(f"{theirs}/assignments", json={"user_id": user_id}).status_code == expected
        )
    first = client.post(f"{theirs}/assignments", json={"user_id": str(tech.id)})
    assert first.status_code == 201 and first.json()["kind"] == "assigned"
    assert client.post(f"{theirs}/assignments", json={"user_id": str(tech.id)}).status_code == 409
    assert client.get(f"{theirs}/assignments").json() == [str(tech.id)]
    assert deliver() == 1
    assert heard("sw_tech") == ["Support request assigned to you"]
    assert deliver() == 0  # replaying delivered events does nothing
    assert heard("sw_tech") == ["Support request assigned to you"]

    # The assigned technician sees the problem but never the customer; others see nothing.
    act_as("sw_tech")
    listing = client.get("/technician/support-cases").json()
    assert [c["id"] for c in listing] == [cid] and listing[0]["unsafe_now"] is True
    detail = client.get(f"/technician/support-cases/{cid}").json()
    assert detail["symptom"] == "Inverter beeps"
    assert str(DEMO_CUSTOMER[0]) not in str(detail)
    for subject in ("sw_tech_two", "sw_foreign_tech", CUSTOMER, STAFF_A):
        act_as(subject)
        assert client.get(f"/technician/support-cases/{cid}").status_code == 404, subject
        assert (
            client.post(f"/technician/support-cases/{cid}/updates", json={"body": "x"}).status_code
            == 404
        )

    # Updates: the technician's note can stay internal; a shared one reaches the customer.
    act_as("sw_tech")
    key = str(uuid4())
    internal = client.post(
        f"/technician/support-cases/{cid}/updates",
        json={"body": "Fault on string 2", "shared": False},
        headers={"Idempotency-Key": key},
    )
    assert internal.status_code == 201
    retry = client.post(
        f"/technician/support-cases/{cid}/updates",
        json={"body": "Fault on string 2", "shared": False},
        headers={"Idempotency-Key": key},
    )
    assert retry.status_code == 200 and retry.json()["id"] == internal.json()["id"]
    shared = client.post(
        f"/technician/support-cases/{cid}/updates", json={"body": "I will visit tomorrow"}
    )
    assert shared.status_code == 201
    assert deliver() == 2
    assert heard("sw_tech") == ["Support request assigned to you"]  # the author is not told
    assert heard(CUSTOMER) == ["New update on a support request"]  # only the shared one
    assert heard(STAFF_B).count("New update on a support request") == 2
    assert deliver() == 0

    # Statuses follow the allowed moves, with history and a reason where required.
    act_as(STAFF_B)
    status = f"{theirs}/status"
    assert client.post(status, json={"to": "resolved"}).status_code == 409  # work comes first
    assert client.post(status, json={"to": "in_progress"}).json()["status"] == "in_progress"
    assert client.post(status, json={"to": "closed"}).status_code == 409  # needs a reason
    skey = str(uuid4())
    done = client.post(
        status,
        json={"to": "resolved", "body": "Replaced the fuse"},
        headers={"Idempotency-Key": skey},
    )
    assert done.json()["status"] == "resolved"
    again = client.post(
        status,
        json={"to": "resolved", "body": "Replaced the fuse"},
        headers={"Idempotency-Key": skey},
    )
    assert again.status_code == 200 and again.json()["status"] == "resolved"  # a retry, not a 409
    assert deliver() == 2  # in progress and resolved, one notification event each
    assert heard(CUSTOMER).count("Support request status changed") == 2

    # The customer reads only shared updates, with no names, and can reopen or message.
    act_as(CUSTOMER)
    seen = client.get(f"{mine}/updates").json()
    assert all(u["shared"] for u in seen) and len(seen) == 3  # one note, two statuses
    assert "Fault on string 2" not in str(seen) and all(u["actor_id"] is None for u in seen)
    assert all(u["actor_role"] is None for u in seen)
    reopen = client.post(f"{mine}/status", json={"to": "open"})
    assert reopen.json()["status"] == "open"
    assert client.post(f"{mine}/status", json={"to": "in_progress"}).status_code == 409
    msg = client.post(f"{mine}/updates", json={"body": "Still beeping", "shared": False})
    assert (
        msg.status_code == 201 and msg.json()["shared"] is True
    )  # a customer cannot hide a message
    assert deliver() == 2
    assert "New update on a support request" in heard(
        "sw_tech"
    )  # the technician hears the customer
    assert deliver() == 0

    # Company staff read the full history with who and in which role; the customer stays hidden.
    act_as(STAFF_B)
    full = client.get(f"{theirs}/updates").json()
    assert [u["kind"] for u in full] == [
        "assigned", "message", "message", "status", "status", "status", "message"
    ]  # fmt: skip
    assert {u["actor_role"] for u in full} == {"staff", "technician", "customer"}
    assert all(u["actor_id"] is None for u in full if u["actor_role"] == "customer")
    assert "Fault on string 2" in str(full)

    # Removing the technician ends their access and tells only them.
    gone = client.delete(f"{theirs}/assignments/{tech.id}")
    assert gone.status_code == 200 and gone.json()["kind"] == "unassigned"
    assert client.delete(f"{theirs}/assignments/{tech.id}").status_code == 404
    act_as("sw_tech")
    assert client.get(f"/technician/support-cases/{cid}").status_code == 404
    deliver()
    assert "Removed from a support request" in heard("sw_tech")

    # Closed is final, and nobody outside can touch the case.
    act_as(STAFF_B)
    assert (
        client.post(status, json={"to": "closed", "body": "Duplicate"}).json()["status"] == "closed"
    )
    for path, payload in (
        (f"{theirs}/updates", {"body": "late"}),
        (f"{theirs}/assignments", {"user_id": str(tech_two.id)}),
        (status, {"to": "in_progress"}),
    ):
        assert client.post(path, json=payload).status_code == 409
    act_as(STAFF_A)
    assert client.post(f"{theirs}/updates", json={"body": "x"}).status_code == 403
    act_as("sw_stranger")
    assert client.post(f"{mine}/updates", json={"body": "x"}).status_code == 404
    assert client.get(f"{mine}/updates").status_code == 404

    # A twin of an update with the same key cannot exist, even if it bypasses the API.
    row = session.scalars(
        select(SupportCaseUpdate).where(SupportCaseUpdate.idempotency_key.is_not(None))
    ).first()
    session.execute(text("SAVEPOINT s"))
    with pytest.raises(Exception, match="uq_support_update_idempotency"):
        session.execute(
            text(
                "INSERT INTO support_case_updates (id, case_id, actor_id, actor_role, kind, shared,"
                " idempotency_key) VALUES (:i, :c, :a, 'staff', 'message', true, :k)"
            ),
            {"i": uuid4(), "c": row.case_id, "a": row.actor_id, "k": row.idempotency_key},
        )
    session.execute(text("ROLLBACK TO SAVEPOINT s"))

    # Every update has exactly one outbox event, and every notification exactly one source.
    updates = session.scalar(select(func.count()).select_from(SupportCaseUpdate))
    events = session.scalar(
        select(func.count())
        .select_from(OutboxEvent)
        .where(OutboxEvent.event_type == "support.case_updated")
    )
    assert updates == events == 9
