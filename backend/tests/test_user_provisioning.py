"""Provisioning checks use a transaction-isolated PostgreSQL schema."""

from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends
from sqlalchemy import func, select, text

from app.api.dependencies import require_local_user
from app.core.auth import VerifiedIdentity, require_identity
from app.core.permissions import Action, required_scopes
from app.models.user import AppUser
from app.services.users import provision_user


@pytest.fixture
def user_table(database_connection):
    schema = f"provisioning_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    AppUser.__table__.create(database_connection)


@pytest.mark.database
def test_repeated_provisioning(database_session, user_table):
    identity = VerifiedIdentity(subject="user_verified", session_id="session_one")
    first = provision_user(database_session, identity)
    database_session.commit()
    first_id, created_at = first.id, first.created_at
    database_session.expunge_all()
    repeated = provision_user(
        database_session, VerifiedIdentity(subject=identity.subject, session_id="session_two")
    )
    database_session.commit()
    assert (repeated.id, repeated.created_at) == (first_id, created_at)
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 1
    other = provision_user(
        database_session, VerifiedIdentity(subject="user_other", session_id="session_other")
    )
    assert other.id != first_id
    assert repeated.role == other.role == "customer"
    assert not required_scopes(Action.USER_STATUS_MANAGE, repeated.role)


@pytest.mark.database
def test_dependency_provisions_only_verified_identity(
    database_client, database_session, user_table
):
    @database_client.app.get("/test-local-user")
    def local_user(user: Annotated[AppUser, Depends(require_local_user)]):
        return {"id": str(user.id), "subject": user.clerk_subject, "role": user.role}

    assert database_client.get("/test-local-user?subject=user_fake").status_code == 401
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 0
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject="user_verified", session_id="session_one"
    )
    first = database_client.request(
        "GET",
        "/test-local-user?subject=user_fake&role=platform_admin",
        headers={"X-Role": "platform_admin"},
        json={"role": "platform_admin", "is_admin": True},
    )
    second = database_client.get("/test-local-user")
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["role"] == "customer"
    assert first.json()["subject"] == "user_verified"
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 1


def test_raw_subject_is_rejected():
    with pytest.raises(TypeError, match="verified identity"):
        provision_user(None, "user_unverified")


def test_provisioning_does_not_accept_role():
    with pytest.raises(TypeError):
        provision_user(None, VerifiedIdentity("user_test", "session_test"), role="platform_admin")


@pytest.mark.database
def test_current_user_returns_only_own_profile(database_client, database_session, user_table):
    other = provision_user(database_session, VerifiedIdentity("user_other", "session_other"))
    database_session.commit()
    other_id = str(other.id)
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_current", "session_current"
    )
    response = database_client.get(
        f"/users/me?user_id={other_id}&subject=user_other&role=platform_admin"
    )
    assert response.status_code == 200
    profile = response.json()
    assert set(profile) == {"id", "role", "created_at"}
    assert profile["id"] != other_id
    assert profile["role"] == "customer"
    assert profile["created_at"].endswith("Z")
    assert response.headers["cache-control"] == "no-store"
    assert database_client.get("/users/me").json() == profile
    current = database_session.scalar(
        select(AppUser).where(AppUser.clerk_subject == "user_current")
    )
    assert profile["id"] == str(current.id)


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer malformed"}])
def test_current_user_requires_authentication(client, headers):
    # Missing Clerk configuration fails closed for a supplied token.
    response = client.get("/users/me", headers=headers)
    assert response.status_code == (503 if headers else 401)
    assert set(response.json()) == {"error"}


@pytest.mark.database
@pytest.mark.parametrize("role", ["customer", "platform_admin"])
def test_suspended_accounts_cannot_use_protected_routes(
    database_client, database_session, user_table, role
):
    identity = VerifiedIdentity("user_suspension_test", "session_existing")
    user = provision_user(database_session, identity)
    user.role = role
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: identity
    assert database_client.get("/users/me").status_code == 200

    user.is_suspended = True
    database_session.commit()
    for _ in range(2):
        response = database_client.get("/users/me?is_suspended=false")
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "forbidden"
    database_session.refresh(user)
    assert user.is_suspended is True
    assert user.role == role
    assert database_client.get("/health").status_code == 200

    user.is_suspended = False
    database_session.commit()
    assert database_client.get("/users/me").status_code == 200
