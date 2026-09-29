"""Platform activity and audit details stay behind platform permissions."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.audit import AuditEvent
from app.models.company import Company
from app.models.product import Product
from app.models.user import AppUser
from app.services.audit import AuditAction

pytestmark = pytest.mark.database


def test_activity_counts_and_audit_detail_access(
    database_client, database_connection, database_session
):
    schema = f"admin_activity_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, Product, AuditEvent):
        model.__table__.create(database_connection)
    admin = AppUser(clerk_subject=f"admin_{schema}", role="platform_admin")
    customer = AppUser(clerk_subject=f"customer_{schema}")
    approved = Company(name="Approved", publication_status="approved")
    draft = Company(name="Draft")
    active = Product(kind="panel", brand="A", model="A1")
    archived = Product(kind="panel", brand="B", model="B1", is_archived=True)
    database_session.add_all([admin, customer, approved, draft, active, archived])
    database_session.flush()
    event = AuditEvent(
        actor_id=admin.id,
        company_id=approved.id,
        target_id=approved.id,
        action=AuditAction.COMPANY_APPROVED.value,
    )
    database_session.add(event)
    database_session.commit()
    activity_path = "/admin/activity"
    event_path = f"/audit-events/{event.id}"

    assert database_client.get(activity_path).status_code == 401
    assert database_client.get(event_path).status_code == 401
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        customer.clerk_subject, "customer_session"
    )
    assert database_client.get(activity_path).status_code == 403
    assert database_client.get(event_path).status_code == 403

    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        admin.clerk_subject, "admin_session"
    )
    activity = database_client.get(activity_path)
    assert activity.status_code == 200
    assert activity.json() == {
        "users": 2,
        "approved_companies": 1,
        "active_products": 1,
        "audit_events": 1,
    }
    assert activity.headers["cache-control"] == "no-store"
    detail = database_client.get(event_path)
    assert detail.status_code == 200
    assert detail.json()["company_id"] == str(approved.id)
    assert detail.json()["action"] == AuditAction.COMPANY_APPROVED.value
    assert detail.headers["cache-control"] == "no-store"
    assert database_client.get(f"/audit-events/{uuid4()}").status_code == 404
