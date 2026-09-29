"""Recipient identity scopes notification reads and mutations."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.notification import Notification
from app.models.user import AppUser

pytestmark = pytest.mark.database


def test_notification_reads_and_marks_are_recipient_scoped(
    database_client, database_connection, database_session
):
    schema = f"notifications_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    AppUser.__table__.create(database_connection)
    Notification.__table__.create(database_connection)
    owner = AppUser(clerk_subject=f"owner_{schema}")
    other = AppUser(clerk_subject=f"other_{schema}")
    database_session.add_all([owner, other])
    database_session.flush()
    first = Notification(
        recipient_id=owner.id,
        kind="installation_update",
        title="Work started",
        body="Site survey is underway",
        target_kind="installation",
        target_id=uuid4(),
    )
    second = Notification(
        recipient_id=other.id,
        kind="installation_update",
        title="Private notice",
        body="Only another user may see this",
        target_kind="installation",
        target_id=uuid4(),
    )
    database_session.add_all([first, second])
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        owner.clerk_subject, "session_test"
    )
    base = "/users/me/notifications"
    listed = database_client.get(base)
    assert listed.status_code == 200, listed.json()
    assert listed.json()["total"] == 1
    assert [item["id"] for item in listed.json()["items"]] == [str(first.id)]
    assert database_client.get(f"{base}/{first.id}").status_code == 200
    assert database_client.get(f"{base}/{second.id}").status_code == 404
    assert database_client.put(f"{base}/{second.id}/read").status_code == 404
    assert database_client.put(f"{base}/{second.id}/unread").status_code == 404
    assert (
        database_session.scalar(select(Notification.read_at).where(Notification.id == second.id))
        is None
    )

    read = database_client.put(f"{base}/{first.id}/read")
    assert read.status_code == 200
    assert read.json()["read_at"] is not None
    assert (
        database_client.put(f"{base}/{first.id}/read").json()["read_at"] == read.json()["read_at"]
    )
    assert database_client.get(f"{base}?unread_only=true").json()["total"] == 0
    assert database_client.put(f"{base}/{first.id}/unread").json()["read_at"] is None
    assert database_client.get(f"{base}?unread_only=true").json()["total"] == 1

    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        other.clerk_subject, "session_test"
    )
    assert database_client.get(f"{base}/{first.id}").status_code == 404
    assert database_client.put(f"{base}/{first.id}/read").status_code == 404
    assert database_client.get(f"{base}/{second.id}").status_code == 200
