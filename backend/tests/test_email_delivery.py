"""Each notification becomes at most one email, however often a job retries."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from app.models.email_delivery import EmailDelivery
from app.models.outbox_event import OutboxEvent
from app.models.site_visit import SiteVisit
from app.models.user import AppUser
from app.seed_demo import DEMO_CUSTOMER, demo_id, seed_demo
from app.services.email_delivery import (
    ClerkEmailDirectory,
    LocalEmailDirectory,
    Mailer,
    email_once,
)
from app.services.mail import Mail, SinkMailSender
from app.services.reminders import run_reminders
from app.services.workflow_notifications import process_workflow_event

pytestmark = pytest.mark.database

CUSTOMER_ID, CUSTOMER_SUBJECT = DEMO_CUSTOMER


def mailer_in(tmp_path) -> Mailer:
    return Mailer(SinkMailSender("from@example.test", tmp_path / "mail"), LocalEmailDirectory())


def sent_to(mailer: Mailer, address: str) -> list[dict]:
    return [m for m in mailer.sender.messages() if m["to"] == address]


def send(session, mailer, key="k1", user=CUSTOMER_ID):
    return email_once(
        session, mailer, recipient_id=user, dedupe_key=key, kind="t", subject="Hi", body="Body"
    )


def test_one_email_per_key_and_failures_leave_no_record(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = mailer_in(tmp_path)
    assert send(session, mailer) is True
    assert send(session, mailer) is False
    assert len(mailer.sender.messages()) == 1
    assert "fictional portfolio demo" in mailer.sender.messages()[0]["body"]

    class Failing:
        def send(self, mail: Mail) -> None:
            raise OSError("down")

    broken = Mailer(Failing(), LocalEmailDirectory())
    with pytest.raises(OSError):
        send(session, broken, key="k2")
    assert session.scalar(select(func.count()).where(EmailDelivery.dedupe_key == "k2")) == 0
    assert send(session, mailer, key="k2") is True


def test_suspended_accounts_and_missing_addresses_get_nothing(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = mailer_in(tmp_path)
    session.get(AppUser, CUSTOMER_ID).is_suspended = True
    session.flush()
    assert send(session, mailer) is False

    class Nobody:
        def address_for(self, subject):
            return None

    session.get(AppUser, CUSTOMER_ID).is_suspended = False
    session.flush()
    assert send(session, Mailer(mailer.sender, Nobody())) is False
    assert mailer.sender.messages() == []


def test_the_clerk_directory_returns_only_the_primary_address():
    directory = ClerkEmailDirectory.__new__(ClerkEmailDirectory)
    user = SimpleNamespace(
        primary_email_address_id="e2",
        email_addresses=[
            SimpleNamespace(id="e1", email_address="old@example.org"),
            SimpleNamespace(id="e2", email_address="main@example.org"),
        ],
    )
    directory.client = SimpleNamespace(users=SimpleNamespace(get=lambda user_id: user))
    assert directory.address_for("user_1") == "main@example.org"
    user.primary_email_address_id = "missing"
    assert directory.address_for("user_1") is None


def test_an_offer_event_emails_the_customer_once(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = mailer_in(tmp_path)
    revision_id = demo_id("revised", "revision", "2")
    session.add(
        OutboxEvent(
            event_key=f"quotation.sent:{revision_id}",
            event_type="quotation.sent",
            aggregate_kind="quotation_revision",
            aggregate_id=revision_id,
            payload={},
        )
    )
    session.commit()
    key = f"quotation.sent:{revision_id}"
    assert process_workflow_event(session, key, mailer=mailer) is True
    assert process_workflow_event(session, key, mailer=mailer) is False
    mine = sent_to(mailer, f"{CUSTOMER_SUBJECT}@example.test")
    assert [m["subject"] for m in mine] == ["You have a new offer"]


def test_a_retry_after_a_failed_send_emails_once(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    good = mailer_in(tmp_path)
    calls = {"n": 0}

    class Flaky:
        def send(self, mail: Mail) -> None:
            calls["n"] += 1
            if calls["n"] == 1:
                raise OSError("temporary")
            good.sender.send(mail)

    revision_id = demo_id("revised", "revision", "2")
    key = f"quotation.sent:{revision_id}"
    session.add(
        OutboxEvent(
            event_key=key,
            event_type="quotation.sent",
            aggregate_kind="quotation_revision",
            aggregate_id=revision_id,
            payload={},
        )
    )
    session.commit()
    flaky = Mailer(Flaky(), LocalEmailDirectory())
    with pytest.raises(OSError):
        process_workflow_event(session, key, mailer=flaky)
    assert process_workflow_event(session, key, mailer=flaky) is True
    assert len(good.sender.messages()) == 1


def test_a_confirmed_visit_emails_both_people_once_and_a_cancelled_one_nobody(
    database_session, tmp_path
):
    session = database_session
    seed_demo(session, environment="test")
    technician = AppUser(clerk_subject="mail_tech")
    session.add(technician)
    session.flush()
    start = datetime(2031, 5, 1, 9, tzinfo=UTC)
    visit = SiteVisit(
        installation_id=demo_id("accepted", "installation"),
        requested_by=CUSTOMER_ID,
        status="confirmed",
        timezone="Asia/Colombo",
        technician_id=technician.id,
        confirmed_starts_at=start,
        confirmed_ends_at=start + timedelta(hours=1),
    )
    session.add(visit)
    session.flush()
    key = f"site_visit.confirmed:{visit.id}:x"
    session.add(
        OutboxEvent(
            event_key=key,
            event_type="site_visit.confirmed",
            aggregate_kind="site_visit",
            aggregate_id=visit.id,
            payload={},
        )
    )
    session.commit()
    mailer = mailer_in(tmp_path)
    assert process_workflow_event(session, key, mailer=mailer) is True
    assert process_workflow_event(session, key, mailer=mailer) is False
    assert len(sent_to(mailer, f"{CUSTOMER_SUBJECT}@example.test")) == 1
    assert len(sent_to(mailer, "mail_tech@example.test")) == 1

    visit.status = "cancelled"
    other = f"site_visit.confirmed:{visit.id}:y"
    session.add(
        OutboxEvent(
            event_key=other,
            event_type="site_visit.confirmed",
            aggregate_kind="site_visit",
            aggregate_id=visit.id,
            payload={},
        )
    )
    session.commit()
    process_workflow_event(session, other, mailer=mailer)
    assert len(mailer.sender.messages()) == 2


def test_reminders_email_once_across_runs(database_session, tmp_path):
    session = database_session
    seed_demo(session, environment="test")
    mailer = mailer_in(tmp_path)
    from app.models.quotation import QuotationRevision

    valid_until = session.get(QuotationRevision, demo_id("revised", "revision", "2")).valid_until
    now = valid_until - timedelta(days=2)
    assert run_reminders(session, now, mailer)["quotations"] == 1
    assert run_reminders(session, now + timedelta(hours=1), mailer)["quotations"] == 0
    mine = sent_to(mailer, f"{CUSTOMER_SUBJECT}@example.test")
    assert [m["subject"] for m in mine] == ["An offer is about to expire"]
