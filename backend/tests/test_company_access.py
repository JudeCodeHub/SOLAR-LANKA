"""Company identifiers cannot substitute for an active local membership."""

from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends
from sqlalchemy import select, text

from app.api.company_access import require_company_membership, require_company_permission
from app.core.auth import VerifiedIdentity, require_identity
from app.core.permissions import Action
from app.models.audit import AuditEvent
from app.models.company import Company, CompanyMembership, CompanyReview
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def company_access(database_client, database_connection, database_session):
    schema = f"company_access_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for table in (
        AppUser.__table__,
        Company.__table__,
        CompanyMembership.__table__,
        CompanyReview.__table__,
        AuditEvent.__table__,
    ):
        table.create(database_connection)
    user = AppUser(clerk_subject="user_current")
    other = AppUser(clerk_subject="user_other")
    own_company, foreign_company = Company(name="Own"), Company(name="Foreign")
    database_session.add_all([user, other, own_company, foreign_company])
    database_session.flush()
    membership = CompanyMembership(user_id=user.id, company_id=own_company.id, role="sales")
    database_session.add_all(
        [
            membership,
            CompanyMembership(
                user_id=other.id, company_id=foreign_company.id, role="company_admin"
            ),
        ]
    )
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_current", "session_current"
    )

    @database_client.app.get("/test-companies/{company_id}")
    def company_route(member: Annotated[CompanyMembership, Depends(require_company_membership)]):
        return {"company_id": str(member.company_id), "role": member.role}

    return database_client, user, membership, own_company.id, foreign_company.id


def test_own_company_only(company_access):
    client, user, membership, own, foreign = company_access
    response = client.get(f"/test-companies/{own}")
    assert response.status_code == 200
    assert response.json() == {"company_id": str(own), "role": "sales"}
    for target in (foreign, uuid4()):
        response = client.get(
            f"/test-companies/{target}?company_id={own}&user_id={user.id}&role=company_admin",
            headers={"X-Company-ID": str(own)},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize("restriction", ["membership", "user", "deleted", "platform_admin"])
def test_restricted_access(company_access, database_session, restriction):
    client, user, membership, own, foreign = company_access
    target = own
    if restriction == "membership":
        membership.status = "suspended"
    elif restriction == "user":
        user.is_suspended = True
    elif restriction == "deleted":
        user.provider_state = "deleted"
    else:
        user.role = "platform_admin"
        target = foreign
    database_session.commit()
    assert client.get(f"/test-companies/{target}").status_code == 403


def test_missing_identity(company_access):
    client, _, _, own, _ = company_access
    client.app.dependency_overrides.pop(require_identity)
    assert client.get(f"/test-companies/{own}").status_code == 401


@pytest.mark.parametrize(
    "role,action,expected",
    [
        ("company_admin", Action.MEMBERSHIP_MANAGE, 200),
        ("sales", Action.MEMBERSHIP_MANAGE, 403),
        ("technician", Action.MEMBERSHIP_MANAGE, 403),
        ("company_admin", Action.COMPANY_UPDATE, 200),
        ("sales", Action.COMPANY_UPDATE, 200),
        ("technician", Action.COMPANY_UPDATE, 403),
        ("company_admin", Action.COMPANY_REVIEW, 403),
        ("sales", Action.COMPANY_REVIEW, 403),
        ("company_admin", Action.QUOTATION_SEND, 403),
        ("company_admin", "unknown.action", 403),
    ],
)
def test_company_action_policy(company_access, database_session, role, action, expected):
    client, _, membership, own, foreign = company_access
    membership.role = role
    database_session.commit()
    permission = require_company_permission(action)

    @client.app.post("/test-actions/{company_id}")
    def protected_action(member: Annotated[CompanyMembership, Depends(permission)]):
        return {"role": member.role}

    response = client.post(
        f"/test-actions/{own}?role=company_admin&action=company.update",
        json={"role": "company_admin"},
    )
    assert response.status_code == expected
    assert client.post(f"/test-actions/{foreign}").status_code == 403
    membership.status = "suspended"
    database_session.commit()
    assert client.post(f"/test-actions/{own}").status_code == 403


@pytest.mark.parametrize("role", ["sales", "company_admin", "technician"])
def test_admin_assigns_membership(company_access, database_session, role):
    client, _, actor, own, foreign = company_access
    actor.role = "company_admin"
    target = AppUser(clerk_subject="user_assignee")
    database_session.add(target)
    database_session.commit()
    target_id = target.id
    payload = {"user_id": str(target_id), "role": role}
    assert client.post(f"/companies/{foreign}/memberships", json=payload).status_code == 403
    response = client.post(f"/companies/{own}/memberships", json=payload)
    assert response.status_code == 201
    assert response.json()["company_id"] == str(own)
    assert response.json()["role"] == role
    payload["role"] = "company_admin"
    assert client.post(f"/companies/{own}/memberships", json=payload).status_code == 409
    grant = database_session.scalars(
        select(CompanyMembership).where(
            CompanyMembership.user_id == target_id,
            CompanyMembership.company_id == own,
        )
    ).one()
    assert grant.role == role
    database_session.refresh(target)
    assert target.role == "customer"


@pytest.mark.parametrize("mode", ["public", "sales", "self", "platform_role", "inactive", "extra"])
def test_membership_assignment_restrictions(company_access, database_session, mode):
    client, user, actor, own, _ = company_access
    actor.role = "company_admin" if mode not in {"sales", "public"} else "sales"
    target = AppUser(clerk_subject="user_target", is_suspended=(mode == "inactive"))
    database_session.add(target)
    if mode == "public":
        database_session.delete(actor)
    database_session.commit()
    payload = {
        "user_id": str(user.id if mode in {"public", "self"} else target.id),
        "role": "platform_admin" if mode == "platform_role" else "sales",
    }
    if mode == "extra":
        payload["company_id"] = str(own)
    response = client.post(f"/companies/{own}/memberships", json=payload)
    assert response.status_code == (
        {"platform_role": 422, "extra": 422, "inactive": 409}.get(mode, 403)
    )
    database_session.expire_all()
    assert (
        database_session.scalar(
            select(CompanyMembership).where(
                CompanyMembership.user_id == target.id,
                CompanyMembership.company_id == own,
            )
        )
        is None
    )


@pytest.mark.parametrize("role", ["company_admin", "sales"])
def test_company_profile_read_edit(company_access, database_session, role):
    client, _, member, own, foreign = company_access
    member.role = role
    database_session.commit()
    response = client.get(f"/companies/{own}")
    assert response.status_code == 200
    assert set(response.json()) == {
        "id",
        "name",
        "publication_status",
        "created_at",
        "service_districts",
        "services",
        "declared_credentials",
    }
    assert response.headers["cache-control"] == "no-store"
    updated = client.patch(f"/companies/{own}", json={"name": "  Updated Company  "})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Company"
    assert client.get(f"/companies/{own}").json()["name"] == "Updated Company"
    assert client.get(f"/companies/{foreign}").status_code == 403
    assert (
        client.patch(
            f"/companies/{foreign}?company_id={own}", json={"name": "Unauthorized"}
        ).status_code
        == 403
    )
    database_session.expire_all()
    assert database_session.get(Company, foreign).name == "Foreign"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"name": None},
        {"name": "   "},
        {"name": "x" * 256},
        {"name": "Valid", "publication_status": "approved"},
        {"name": "Valid", "id": str(uuid4())},
    ],
)
def test_company_profile_rejects_invalid_fields(company_access, body):
    client, _, _, own, _ = company_access
    assert client.patch(f"/companies/{own}", json=body).status_code == 422
    profile = client.get(f"/companies/{own}").json()
    assert profile["name"] == "Own"
    assert profile["publication_status"] == "draft"


@pytest.mark.parametrize("restriction", ["technician", "suspended", "public", "anonymous"])
def test_company_profile_access_restrictions(company_access, database_session, restriction):
    client, _, member, own, _ = company_access
    if restriction == "technician":
        member.role = "technician"
    elif restriction == "suspended":
        member.status = "suspended"
    elif restriction == "public":
        database_session.delete(member)
    else:
        client.app.dependency_overrides.pop(require_identity)
    database_session.commit()
    expected = 401 if restriction == "anonymous" else 403
    assert client.get(f"/companies/{own}").status_code == expected
    assert client.patch(f"/companies/{own}", json={"name": "Blocked"}).status_code == expected


def test_company_services_and_credentials(company_access):
    client, _, _, own, foreign = company_access
    payload = {
        "service_districts": ["Colombo", "Gampaha"],
        "services": ["installation"],
        "declared_credentials": [{"name": "Demo credential", "issuer": "Demo issuer"}],
    }
    assert client.patch(f"/companies/{foreign}", json=payload).status_code == 403
    response = client.patch(f"/companies/{own}", json=payload)
    assert response.status_code == 200
    profile = client.get(f"/companies/{own}").json()
    assert profile["name"] == "Own"
    assert profile["service_districts"] == payload["service_districts"]
    assert profile["services"] == payload["services"]
    assert profile["declared_credentials"][0]["verification_status"] == "company_declared"
    assert client.patch(f"/companies/{own}", json={"services": []}).status_code == 200
    assert client.get(f"/companies/{own}").json()["services"] == []


@pytest.mark.parametrize(
    "payload",
    [
        {"service_districts": ["Unsupported"]},
        {"services": ["unsupported"]},
        {"services": ["installation", "installation"]},
        {"service_districts": None},
        {
            "declared_credentials": [
                {"name": "Demo", "issuer": "Demo", "verification_status": "verified"}
            ]
        },
        {"declared_credentials": [{"name": " ", "issuer": "Demo"}]},
    ],
)
def test_company_service_validation(company_access, payload):
    client, _, _, own, _ = company_access
    assert client.patch(f"/companies/{own}", json=payload).status_code == 422


def test_company_submission_history(company_access, database_session):
    client, user, _, own, foreign = company_access
    response = client.post(
        f"/companies/{own}/submit", json={"actor_id": str(uuid4()), "outcome": "approved"}
    )
    assert response.status_code == 201
    entry = response.json()
    assert entry["actor_id"] == str(user.id)
    assert entry["outcome"] == "submitted"
    assert entry["created_at"].endswith("Z")
    assert client.get(f"/companies/{own}").json()["publication_status"] == "pending"
    assert client.post(f"/companies/{own}/submit").status_code == 409
    assert client.get(f"/companies/{own}/reviews").json() == [entry]
    assert client.get(f"/companies/{own}/reviews?limit=1&offset=1").json() == []
    assert client.post(f"/companies/{foreign}/submit").status_code == 403
    assert client.get(f"/companies/{foreign}/reviews").status_code == 403
    company = database_session.get(Company, own)
    company.publication_status = "rejected"
    database_session.commit()
    assert client.post(f"/companies/{own}/submit").status_code == 201
    history = client.get(f"/companies/{own}/reviews").json()
    assert len(history) == 2
    assert entry in history


def test_technician_cannot_submit_or_read_reviews(company_access, database_session):
    client, _, member, own, _ = company_access
    member.role = "technician"
    database_session.commit()
    assert client.post(f"/companies/{own}/submit").status_code == 403
    assert client.get(f"/companies/{own}/reviews").status_code == 403


@pytest.mark.parametrize("outcome", ["approved", "rejected"])
def test_admin_review_and_publication(company_access, database_session, outcome):
    client, user, _, own, _ = company_access
    assert client.get(f"/public/companies/{own}").status_code == 404
    assert client.get("/public/companies").json() == []
    assert client.post(f"/companies/{own}/submit").status_code == 201
    assert client.get(f"/public/companies/{own}").status_code == 404
    assert client.post(f"/companies/{own}/review", json={"outcome": outcome}).status_code == 403
    user.role = "platform_admin"
    database_session.commit()
    reviewed = client.post(f"/companies/{own}/review", json={"outcome": outcome})
    assert reviewed.status_code == 201
    assert reviewed.json()["actor_id"] == str(user.id)
    assert reviewed.json()["outcome"] == outcome
    assert client.post(f"/companies/{own}/review", json={"outcome": outcome}).status_code == 409
    history = client.get(f"/companies/{own}/reviews").json()
    assert {entry["outcome"] for entry in history} == {"submitted", outcome}
    client.app.dependency_overrides.pop(require_identity)
    public = client.get(f"/public/companies/{own}")
    assert public.status_code == (200 if outcome == "approved" else 404)
    listing = client.get("/public/companies").json()
    assert len(listing) == (1 if outcome == "approved" else 0)
    if outcome == "approved":
        assert set(public.json()) == {
            "id",
            "name",
            "services",
            "service_districts",
            "declared_credentials",
        }


def test_profile_changes_require_new_approval(company_access, database_session):
    client, user, _, own, _ = company_access
    client.post(f"/companies/{own}/submit")
    user.role = "platform_admin"
    database_session.commit()
    assert client.post(f"/companies/{own}/review", json={"outcome": "approved"}).status_code == 201
    assert client.patch(f"/companies/{own}", json={"name": "Edited"}).status_code == 200
    assert client.get(f"/public/companies/{own}").status_code == 404
    assert client.get("/public/companies").json() == []
    assert client.post(f"/companies/{own}/review", json={"outcome": "approved"}).status_code == 409
    assert len(client.get(f"/companies/{own}/reviews").json()) == 2


def test_company_admin_cannot_review_and_suspended_admin_denied(company_access, database_session):
    client, user, member, own, _ = company_access
    member.role = "company_admin"
    database_session.commit()
    client.post(f"/companies/{own}/submit")
    assert client.post(f"/companies/{own}/review", json={"outcome": "approved"}).status_code == 403
    user.role = "platform_admin"
    user.is_suspended = True
    database_session.commit()
    assert client.post(f"/companies/{own}/review", json={"outcome": "approved"}).status_code == 403
    assert client.get(f"/public/companies/{own}").status_code == 404


def test_sensitive_changes_are_audited(company_access, database_session):
    client, user, member, own, foreign = company_access
    secret_marker = "secret-value-must-not-be-audited"
    assert client.patch(f"/companies/{own}", json={"name": secret_marker}).status_code == 200
    assert client.post(f"/companies/{own}/submit").status_code == 201
    assert client.get("/audit-events").status_code == 403
    member.role = "company_admin"
    target = AppUser(clerk_subject="user_audit_target")
    database_session.add(target)
    database_session.commit()
    assigned = client.post(
        f"/companies/{own}/memberships", json={"user_id": str(target.id), "role": "sales"}
    )
    assert assigned.status_code == 201
    assert client.get("/audit-events").status_code == 403
    user.role = "platform_admin"
    database_session.commit()
    assert client.post(f"/companies/{own}/review", json={"outcome": "approved"}).status_code == 201
    response = client.get(f"/audit-events?company_id={own}")
    assert response.status_code == 200
    events = response.json()
    assert {e["action"] for e in events} == {
        "company.updated",
        "company.submitted",
        "company.approved",
        "membership.assigned",
    }
    assert all(e["actor_id"] == str(user.id) and e["company_id"] == str(own) for e in events)
    assert all(
        set(e) == {"id", "actor_id", "company_id", "target_id", "action", "created_at"}
        for e in events
    )
    assert secret_marker not in response.text
    assert (
        next(e for e in events if e["action"] == "membership.assigned")["target_id"]
        == assigned.json()["id"]
    )
    assert client.get(f"/audit-events?company_id={foreign}").json() == []
    assert len(client.get("/audit-events?limit=1").json()) == 1
    assert client.get("/audit-events?limit=101").status_code == 422
    user.is_suspended = True
    database_session.commit()
    assert client.get("/audit-events").status_code == 403
    client.app.dependency_overrides.pop(require_identity)
    assert client.get("/audit-events").status_code == 401


def test_audit_failure_rolls_back_change(company_access, database_session, monkeypatch):
    from app.api.routes import companies

    client, _, _, own, _ = company_access

    def fail(*args, **kwargs):
        raise RuntimeError("simulated audit failure")

    monkeypatch.setattr(companies, "record_audit", fail)
    with pytest.raises(RuntimeError):
        client.post(f"/companies/{own}/submit")
    database_session.expire_all()
    assert database_session.get(Company, own).publication_status == "draft"
    assert database_session.scalar(select(AuditEvent)) is None
    assert database_session.scalar(select(CompanyReview)) is None
