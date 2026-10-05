"""Switched-off reminders and email are never sent, and the settings are private to each person."""

from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.core.auth import VerifiedIdentity, require_identity
from app.models.notification import Notification
from app.models.quotation import QuotationRevision
from app.models.user import AppUser
from app.seed_demo import DEMO_CUSTOMER, demo_id, seed_demo
from app.services.email_delivery import LocalEmailDirectory, Mailer, email_once
from app.services.mail import SinkMailSender
from app.services.reminders import run_reminders

pytestmark = pytest.mark.database

CUSTOMER_ID, CUSTOMER_SUBJECT = DEMO_CUSTOMER
URL = "/users/me/notification-preferences"


def put(client, reminders, email, **extra):
    return client.put(URL, json={"reminders_enabled": reminders, "email_enabled": email, **extra})


def act_as(client, subject: str) -> None:
    client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject, "session_test"
    )


def test_defaults_save_and_privacy(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    other = AppUser(clerk_subject="prefs_other")
    session.add(other)
    session.commit()

    act_as(client, CUSTOMER_SUBJECT)
    first = client.get(URL)
    assert first.json() == {"reminders_enabled": True, "email_enabled": True}
    assert first.headers["cache-control"] == "no-store"
    saved = put(client, False, True)
    assert saved.json() == {"reminders_enabled": False, "email_enabled": True}
    assert client.get(URL).json()["reminders_enabled"] is False
    # Saving twice just replaces the same row.
    assert put(client, False, False).status_code == 200
    assert client.get(URL).json() == {"reminders_enabled": False, "email_enabled": False}

    # Someone else is untouched and cannot reach or set another person's switches.
    act_as(client, "prefs_other")
    assert client.get(URL).json() == {"reminders_enabled": True, "email_enabled": True}
    assert put(client, True, True).status_code == 200
    act_as(client, CUSTOMER_SUBJECT)
    assert client.get(URL).json() == {"reminders_enabled": False, "email_enabled": False}

    # Only the two switches are accepted, and both are required.
    assert client.put(URL, json={"reminders_enabled": True}).status_code == 422
    assert put(client, True, True, x=1).status_code == 422
    assert put(client, "yes", True).status_code == 422


def test_signed_out_requests_are_refused(database_client):
    assert database_client.get(URL).status_code in {401, 403}


def test_reminders_off_sends_neither_notification_nor_email(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = Mailer(SinkMailSender("f@example.test", tmp_path / "mail"), LocalEmailDirectory())
    valid_until = session.get(QuotationRevision, demo_id("revised", "revision", "2")).valid_until
    now = valid_until - timedelta(days=2)

    from app.models.notification_preference import NotificationPreference

    session.add(NotificationPreference(user_id=CUSTOMER_ID, reminders_enabled=False))
    session.commit()
    assert run_reminders(session, now, mailer)["quotations"] == 0
    assert mailer.sender.messages() == []

    # Switching them back on sends the reminder, once.
    session.get(NotificationPreference, CUSTOMER_ID).reminders_enabled = True
    session.commit()
    assert run_reminders(session, now, mailer)["quotations"] == 1
    assert run_reminders(session, now, mailer)["quotations"] == 0
    assert len(mailer.sender.messages()) == 1


def test_email_off_keeps_the_in_app_notification_but_sends_no_email(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = Mailer(SinkMailSender("f@example.test", tmp_path / "mail"), LocalEmailDirectory())
    valid_until = session.get(QuotationRevision, demo_id("revised", "revision", "2")).valid_until
    from app.models.notification_preference import NotificationPreference

    session.add(NotificationPreference(user_id=CUSTOMER_ID, email_enabled=False))
    session.commit()
    assert run_reminders(session, valid_until - timedelta(days=2), mailer)["quotations"] == 1
    assert mailer.sender.messages() == []
    count = session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.recipient_id == CUSTOMER_ID)
    )
    assert count == 1
    sent = email_once(
        session, mailer, recipient_id=CUSTOMER_ID, dedupe_key="x", kind="k", subject="s", body="b"
    )
    assert sent is False
