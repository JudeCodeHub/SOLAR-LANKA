"""Only platform administrators can change local account access."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.audit import AuditEvent
from app.models.company import Company
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_platform_account_status_is_authorized_and_audited(
    database_client, database_connection, database_session
):
    schema = f"admin_account_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, AuditEvent):
        model.__table__.create(database_connection)
    administrator = AppUser(clerk_subject=f"admin_{schema}", role="platform_admin")
    customer = AppUser(clerk_subject=f"customer_{schema}")
    database_session.add_all([administrator, customer])
    database_session.commit()
    path = f"/admin/users/{customer.id}/status"

    assert database_client.patch(path, json={"is_suspended": True}).status_code == 401
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        customer.clerk_subject, "customer_session"
    )
    assert database_client.patch(path, json={"is_suspended": True}).status_code == 403
    database_session.refresh(customer)
    assert not customer.is_suspended
    assert database_session.scalar(select(AuditEvent.id)) is None

    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        administrator.clerk_subject, "admin_session"
    )
    assert (
        database_client.patch(
            path, json={"is_suspended": True, "role": "platform_admin"}
        ).status_code
        == 422
    )
    assert (
        database_client.patch(
            f"/admin/users/{uuid4()}/status", json={"is_suspended": True}
        ).status_code
        == 404
    )
    assert (
        database_client.patch(
            f"/admin/users/{administrator.id}/status", json={"is_suspended": True}
        ).status_code
        == 409
    )
    suspended = database_client.patch(path, json={"is_suspended": True})
    assert suspended.status_code == 200
    assert suspended.json() == {
        "id": str(customer.id),
        "is_suspended": True,
        "provider_state": "active",
    }
    database_session.refresh(customer)
    assert customer.is_suspended
    assert database_session.scalar(select(AuditEvent.action)) == "user.suspended"
    audit_response = database_client.get("/audit-events")
    assert audit_response.status_code == 200
    assert audit_response.json()[0]["company_id"] is None
    assert audit_response.json()[0]["action"] == "user.suspended"
    assert database_client.patch(path, json={"is_suspended": True}).status_code == 200
    assert len(database_session.scalars(select(AuditEvent)).all()) == 1

    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        customer.clerk_subject, "customer_session"
    )
    assert database_client.get("/users/me").status_code == 403
    assert database_client.patch(path, json={"is_suspended": False}).status_code == 403

    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        administrator.clerk_subject, "admin_session"
    )
    restored = database_client.patch(path, json={"is_suspended": False})
    assert restored.status_code == 200
    assert restored.json()["is_suspended"] is False
    # The fixture shares one transaction.
    assert sorted(database_session.scalars(select(AuditEvent.action))) == [
        "user.restored",
        "user.suspended",
    ]
    database_session.refresh(customer)
    customer.provider_state = "deleted"
    customer.is_suspended = True
    database_session.commit()
    assert database_client.patch(path, json={"is_suspended": False}).status_code == 409
    database_session.refresh(customer)
    assert customer.is_suspended
