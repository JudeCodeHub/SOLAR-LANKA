"""Company identifiers cannot substitute for an active local membership."""

from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends
from sqlalchemy import select, text

from app.api.company_access import require_company_membership, require_company_permission
from app.core.auth import VerifiedIdentity, require_identity
from app.core.permissions import Action
from app.models.company import Company, CompanyMembership
from app.models.user import AppUser

pytestmark = pytest.mark.database


@pytest.fixture
def company_access(database_client, database_connection, database_session):
    schema = f"company_access_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for table in (AppUser.__table__, Company.__table__, CompanyMembership.__table__):
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
