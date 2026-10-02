"""Only assigned technicians of the owning company see a job, and only its minimum details."""

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.auth import VerifiedIdentity, require_identity
from app.models.audit import AuditEvent
from app.models.company import CompanyMembership
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

SUNBIRD, MOONLEAF, *_ = (company_id for company_id, _ in DEMO_COMPANIES)
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]


def test_assignment_controls_what_a_technician_can_see(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    people = {
        name: AppUser(clerk_subject=name)
        for name in ("tech_one", "tech_two", "tech_other_company", "sales_only", "tech_gone")
    }
    session.add_all(people.values())
    session.flush()
    for name, company, role, status in (
        ("tech_one", SUNBIRD, "technician", "active"),
        ("tech_two", SUNBIRD, "technician", "active"),
        ("tech_other_company", MOONLEAF, "technician", "active"),
        ("sales_only", SUNBIRD, "sales", "active"),
        ("tech_gone", SUNBIRD, "technician", "suspended"),
    ):
        session.add(
            CompanyMembership(user_id=people[name].id, company_id=company, role=role, status=status)
        )
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    installation = demo_id("accepted", "installation")  # belongs to Moonleaf in the demo seed
    # The demo's accepted installation is Moonleaf's; use its staff and technician.
    base = f"/companies/{MOONLEAF}/installations/{installation}/assignments"

    act_as(STAFF_B)  # Moonleaf administrator
    assert client.get(base).json() == []
    for who, expected in (
        ("tech_other_company", 201),
        ("tech_one", 409),  # technician of another company
        ("sales_only", 409),  # not a technician
        ("tech_gone", 409),  # membership no longer active
    ):
        assert client.post(base, json={"user_id": str(people[who].id)}).status_code == expected, who
    assert client.post(base, json={"user_id": str(uuid4())}).status_code == 409
    assert (
        client.post(base, json={"user_id": str(people["tech_other_company"].id)}).status_code == 409
    )
    assert client.post(base, json={"user_id": "x"}).status_code == 422
    assert [a["technician_id"] for a in client.get(base).json()] == [
        str(people["tech_other_company"].id)
    ]

    # Who may assign: not the technician, not the customer, not another company's staff.
    for subject in ("tech_other_company", CUSTOMER, STAFF_A):
        act_as(subject)
        assert client.post(
            base, json={"user_id": str(people["tech_other_company"].id)}
        ).status_code in {403}, subject

    # The assigned technician sees the job and the minimum: no customer, price or notes.
    act_as("tech_other_company")
    listing = client.get("/technician/installations")
    assert [job["id"] for job in listing.json()] == [str(installation)]
    assert listing.json()[0]["district"] == "Colombo"
    detail = client.get(f"/technician/installations/{installation}")
    assert detail.status_code == 200
    body = detail.json()
    assert [s["position"] for s in body["steps"]] == list(range(1, 9))
    allowed = {
        "id",
        "company_id",
        "district",
        "created_at",
        "completed_steps",
        "total_steps",
        "steps",
    }
    assert set(body) == allowed
    text = detail.text
    for secret in (
        str(DEMO_CUSTOMER[0]),
        "Fictional demonstration request",
        "500000",
        "LKR",
        "requirements",
    ):
        assert secret not in text, secret

    # Everyone else gets nothing, and an unassigned job looks like one that does not exist.
    for subject in ("tech_one", "tech_two", "sales_only", "tech_gone"):
        act_as(subject)
        assert client.get("/technician/installations").json() == []
        assert client.get(f"/technician/installations/{installation}").status_code == 404
    act_as("tech_other_company")
    assert client.get(f"/technician/installations/{uuid4()}").status_code == 404
    # A technician cannot reach the company routes for the same job.
    assert client.get(f"/companies/{MOONLEAF}/installations/{installation}").status_code == 403

    # Unassigning removes access at once; losing the membership does too.
    act_as(STAFF_B)
    other = people["tech_other_company"].id
    assert client.delete(f"{base}/{other}").status_code == 204
    assert client.delete(f"{base}/{other}").status_code == 404
    act_as("tech_other_company")
    assert client.get(f"/technician/installations/{installation}").status_code == 404
    act_as(STAFF_B)
    assert client.post(base, json={"user_id": str(other)}).status_code == 201
    membership = session.scalars(
        select(CompanyMembership).where(CompanyMembership.user_id == other)
    ).one()
    membership.status = "suspended"
    session.commit()
    act_as("tech_other_company")
    assert client.get(f"/technician/installations/{installation}").status_code == 404

    # Assigning and unassigning are audited with the actor and the installation.
    actions = [
        (event.action, event.target_id)
        for event in session.scalars(select(AuditEvent).order_by(AuditEvent.created_at))
        if event.action.startswith("installation.")
    ]
    assert actions == [
        ("installation.technician_assigned", installation),
        ("installation.technician_unassigned", installation),
        ("installation.technician_assigned", installation),
    ]
