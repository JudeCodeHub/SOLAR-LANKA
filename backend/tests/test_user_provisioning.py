"""Provisioning checks use a transaction-isolated PostgreSQL schema."""

from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends
from sqlalchemy import func, select, text

from app.api.dependencies import require_local_user
from app.core.auth import VerifiedIdentity, require_identity
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


@pytest.mark.database
def test_dependency_provisions_only_verified_identity(
    database_client, database_session, user_table
):
    @database_client.app.get("/test-local-user")
    def local_user(user: Annotated[AppUser, Depends(require_local_user)]):
        return {"id": str(user.id), "subject": user.clerk_subject}

    assert database_client.get("/test-local-user?subject=user_fake").status_code == 401
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 0
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject="user_verified", session_id="session_one"
    )
    first = database_client.get("/test-local-user?subject=user_fake")
    second = database_client.get("/test-local-user")
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert first.json()["subject"] == "user_verified"
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 1


def test_raw_subject_is_rejected():
    with pytest.raises(TypeError, match="verified identity"):
        provision_user(None, "user_unverified")
