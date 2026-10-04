"""Reminders recheck current state on every run and never send the same reminder twice."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.models.company import Company, CompanyMembership
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.installation_milestone_event import InstallationMilestoneEvent
from app.models.notification import Notification
from app.models.quotation import QuotationRevision
from app.models.site_visit import SiteVisit
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, demo_id, seed_demo
from app.services.reminders import run_reminders

pytestmark = pytest.mark.database

CUSTOMER_ID = DEMO_CUSTOMER[0]
INSTALLATION = demo_id("accepted", "installation")


def count(session, kind: str) -> int:
    return session.scalar(
        select(func.count()).select_from(Notification).where(Notification.kind == kind)
    )


def test_quotation_reminders(database_session):
    session = database_session

    def revise(revision_id, status):
        statement = update(QuotationRevision).where(QuotationRevision.id == revision_id)
        session.execute(statement.values(status=status))

    seed_demo(session, environment="test")
    sent = demo_id("revised", "revision", "2")
    valid_until = session.get(QuotationRevision, sent).valid_until
    assert run_reminders(session, valid_until - timedelta(days=10))["quotations"] == 0
    # A declined offer is not reminded about, whatever it was when the job last ran.
    revise(sent, "declined")
    assert run_reminders(session, valid_until - timedelta(days=2))["quotations"] == 0
    revise(sent, "sent")
    assert run_reminders(session, valid_until + timedelta(days=1))["quotations"] == 0
    assert run_reminders(session, valid_until - timedelta(days=2))["quotations"] == 1
    assert run_reminders(session, valid_until - timedelta(days=1))["quotations"] == 0
    row = session.scalars(
        select(Notification).where(Notification.kind.like("reminder.quotation%"))
    ).one()
    assert row.recipient_id == CUSTOMER_ID and row.target_kind == "request"


def test_visit_reminders_follow_the_confirmed_time(database_session):
    session = database_session
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="reminder_tech")
    session.add(tech)
    session.flush()
    session.add(
        CompanyMembership(user_id=tech.id, company_id=DEMO_COMPANIES[1][0], role="technician")
    )
    start = datetime(2031, 5, 1, 9, tzinfo=UTC)
    visit = SiteVisit(
        installation_id=INSTALLATION,
        requested_by=CUSTOMER_ID,
        status="confirmed",
        timezone="Asia/Colombo",
        technician_id=tech.id,
        confirmed_starts_at=start,
        confirmed_ends_at=start + timedelta(hours=1),
    )
    session.add(visit)
    session.commit()
    assert run_reminders(session, start - timedelta(days=2))["visits"] == 0
    assert run_reminders(session, start - timedelta(hours=20))["visits"] == 2
    assert run_reminders(session, start - timedelta(hours=10))["visits"] == 0
    # A moved visit is a new appointment and is reminded again; a cancelled one is not.
    visit.confirmed_starts_at = start + timedelta(days=1)
    visit.confirmed_ends_at = start + timedelta(days=1, hours=1)
    session.commit()
    assert run_reminders(session, start + timedelta(hours=10))["visits"] == 2
    visit.status = "cancelled"
    session.commit()
    assert run_reminders(session, start + timedelta(hours=11))["visits"] == 0
    # A suspended account is never contacted.
    visit.status = "confirmed"
    tech.is_suspended = True
    visit.confirmed_starts_at = start + timedelta(days=5)
    visit.confirmed_ends_at = start + timedelta(days=5, hours=1)
    session.commit()
    assert run_reminders(session, start + timedelta(days=4, hours=12))["visits"] == 1


def test_maintenance_reminders_are_yearly_and_need_the_service(database_session):
    session = database_session
    seed_demo(session, environment="test")
    milestone = session.scalars(
        select(InstallationMilestoneRecord).where(
            InstallationMilestoneRecord.installation_id == INSTALLATION,
            InstallationMilestoneRecord.kind == "customer_handover",
        )
    ).one()
    assert run_reminders(session, datetime(2040, 1, 1, tzinfo=UTC))["maintenance"] == 0
    done = datetime(2032, 1, 1, tzinfo=UTC)
    milestone.status = "completed"
    session.add(
        InstallationMilestoneEvent(
            milestone_id=milestone.id,
            actor_id=CUSTOMER_ID,
            from_status="in_progress",
            to_status="completed",
            created_at=done,
        )
    )
    session.commit()
    assert run_reminders(session, done + timedelta(days=100))["maintenance"] == 0
    # Moonleaf does not list maintenance, so nothing is sent until it does.
    assert run_reminders(session, done + timedelta(days=400))["maintenance"] == 0
    company = session.get(Company, DEMO_COMPANIES[1][0])
    company.services = [*company.services, "maintenance"]
    session.commit()
    assert run_reminders(session, done + timedelta(days=400))["maintenance"] == 1
    assert run_reminders(session, done + timedelta(days=500))["maintenance"] == 0
    assert run_reminders(session, done + timedelta(days=800))["maintenance"] == 1
    assert count(session, "reminder.maintenance") == 2
