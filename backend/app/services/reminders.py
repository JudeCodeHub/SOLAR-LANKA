"""Scheduled reminders: every run rechecks current state and a stable key stops repeat sends."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.installation_milestone_event import InstallationMilestoneEvent
from app.models.notification import Notification
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.site_visit import SiteVisit
from app.models.user import AppUser
from app.services.email_delivery import Mailer, email_once

QUOTATION_WINDOW = timedelta(days=3)
VISIT_WINDOW = timedelta(hours=24)
# A fictional sample interval; real maintenance advice depends on the equipment and its warranty.
MAINTENANCE_INTERVAL = timedelta(days=365)


def _send(
    session: Session, mailer, recipient_id: UUID, key: str, kind: str, title: str, body: str, target
):
    """Insert once per key; a repeated run or a retry finds the row and adds nothing."""
    active = session.scalar(
        select(AppUser.id).where(
            AppUser.id == recipient_id,
            AppUser.is_suspended.is_(False),
            AppUser.provider_state == "active",
        )
    )
    if active is None:
        return 0
    result = session.execute(
        insert(Notification)
        .values(
            recipient_id=recipient_id,
            dedupe_key=key,
            kind=kind,
            title=title,
            body=body,
            target_kind=target[0],
            target_id=target[1],
        )
        .on_conflict_do_nothing(index_elements=["dedupe_key"])
        .returning(Notification.id)
    )
    created = len(result.all())
    if mailer is not None:
        email_once(
            session,
            mailer,
            recipient_id=recipient_id,
            dedupe_key=key,
            kind=kind,
            subject=title,
            body=body,
        )
    return created


def remind_pending_quotations(session: Session, now: datetime, mailer: Mailer | None = None) -> int:
    """Tell customers an offer still awaiting their answer is about to lapse."""
    accepted = (
        select(QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .where(RequestDelivery.request_id == QuotationRequest.id)
        .where(QuotationRevision.status == "accepted")
    )
    rows = session.execute(
        select(QuotationRevision.id, QuotationRequest.id, QuotationRequest.customer_id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(
            QuotationRevision.status == "sent",
            QuotationRevision.valid_until > now,
            QuotationRevision.valid_until <= now + QUOTATION_WINDOW,
            ~exists(accepted),
        )
    ).all()
    return sum(
        _send(
            session,
            mailer,
            customer_id,
            f"reminder:quotation:{revision_id}",
            "reminder.quotation_expiring",
            "An offer is about to expire",
            "You have an offer that is still waiting for your answer and ends soon.",
            ("request", request_id),
        )
        for revision_id, request_id, customer_id in rows
    )


def remind_confirmed_visits(session: Session, now: datetime, mailer: Mailer | None = None) -> int:
    """Tell the customer and the technician about a confirmed visit starting within a day."""
    visits = session.execute(
        select(SiteVisit).where(
            SiteVisit.status == "confirmed",
            SiteVisit.confirmed_starts_at > now,
            SiteVisit.confirmed_starts_at <= now + VISIT_WINDOW,
        )
    ).scalars()
    sent = 0
    for visit in visits:
        # The start time is in the key, so a rescheduled visit is reminded again.
        stamp = visit.confirmed_starts_at.astimezone(UTC).strftime("%Y%m%dT%H%M")
        for recipient, target in (
            (visit.requested_by, ("installation", visit.installation_id)),
            (visit.technician_id, ("site_visit", visit.id)),
        ):
            if recipient is not None:
                sent += _send(
                    session,
                    mailer,
                    recipient,
                    f"reminder:visit:{visit.id}:{stamp}:{recipient}",
                    "reminder.site_visit",
                    "A site visit is coming up",
                    "A confirmed site visit starts within the next day.",
                    target,
                )
    return sent


def remind_maintenance(session: Session, now: datetime, mailer: Mailer | None = None) -> int:
    """Yearly check-in for customers whose installer lists maintenance as a service."""
    handed_over = (
        select(
            Installation.id,
            QuotationRequest.customer_id,
            Company.services,
            InstallationMilestoneEvent.created_at,
        )
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .join(Company, RequestDelivery.company_id == Company.id)
        .join(
            InstallationMilestoneRecord,
            (InstallationMilestoneRecord.installation_id == Installation.id)
            & (InstallationMilestoneRecord.kind == "customer_handover")
            & (InstallationMilestoneRecord.status == "completed"),
        )
        .join(
            InstallationMilestoneEvent,
            (InstallationMilestoneEvent.milestone_id == InstallationMilestoneRecord.id)
            & (InstallationMilestoneEvent.to_status == "completed"),
        )
    )
    sent = 0
    for installation_id, customer_id, services, completed_at in session.execute(handed_over):
        if "maintenance" not in (services or []):
            continue
        years = int((now - completed_at) / MAINTENANCE_INTERVAL)
        if years < 1:
            continue
        sent += _send(
            session,
            mailer,
            customer_id,
            f"reminder:maintenance:{installation_id}:{years}",
            "reminder.maintenance",
            "Time for a yearly system check",
            "Your installer offers maintenance; consider booking a yearly check.",
            ("installation", installation_id),
        )
    return sent


def run_reminders(
    session: Session, now: datetime | None = None, mailer: Mailer | None = None
) -> dict[str, int]:
    now = now or datetime.now(UTC)
    counts = {
        "quotations": remind_pending_quotations(session, now, mailer),
        "visits": remind_confirmed_visits(session, now, mailer),
        "maintenance": remind_maintenance(session, now, mailer),
    }
    session.commit()
    return counts
