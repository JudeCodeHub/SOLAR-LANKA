"""Idempotently turn trusted outbox records into recipient-owned notifications."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.company import CompanyMembership
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.notification import Notification
from app.models.outbox_event import OutboxEvent
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.support_case import SupportCase, SupportCaseAssignment, SupportCaseUpdate
from app.models.user import AppUser
from app.services.quotation_export import EXPORT_EVENT, build_export


def _customer_and_company(session: Session, installation_id):
    row = session.execute(
        select(QuotationRequest.customer_id, RequestDelivery.company_id)
        .select_from(Installation)
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(Installation.id == installation_id)
    ).one_or_none()
    if row is None:
        raise ValueError("Installation for outbox event was not found")
    return row


def _recipients(session: Session, event: OutboxEvent):
    customer_id, company_id = _customer_and_company(session, event.aggregate_id)
    customer_active = session.scalar(
        select(AppUser.id).where(
            AppUser.id == customer_id,
            AppUser.is_suspended.is_(False),
            AppUser.provider_state == "active",
        )
    )
    if event.event_type == "installation.milestone_changed":
        milestone_id = event.payload.get("milestone_id")
        if not isinstance(milestone_id, str):
            raise ValueError("Milestone outbox reference is invalid")
        try:
            milestone_uuid = UUID(milestone_id)
        except ValueError:
            raise ValueError("Milestone outbox reference is invalid") from None
        if (
            session.scalar(
                select(InstallationMilestoneRecord.id).where(
                    InstallationMilestoneRecord.id == milestone_uuid,
                    InstallationMilestoneRecord.installation_id == event.aggregate_id,
                )
            )
            is None
        ):
            raise ValueError("Milestone outbox reference is invalid")
        return [customer_active] if customer_active is not None else []
    if event.event_type != "quotation.accepted":
        raise ValueError("Unsupported outbox event type")
    staff = session.scalars(
        select(AppUser.id)
        .join(CompanyMembership, CompanyMembership.user_id == AppUser.id)
        .where(
            CompanyMembership.company_id == company_id,
            CompanyMembership.status == "active",
            AppUser.is_suspended.is_(False),
            AppUser.provider_state == "active",
        )
    ).all()
    return list(dict.fromkeys(([customer_active] if customer_active else []) + staff))


SUPPORT_EVENT = "support.case_updated"


def _active(session: Session, user_ids) -> list[UUID]:
    """Only people whose accounts are still active are ever notified."""
    ids = list(dict.fromkeys(user_ids))
    if not ids:
        return []
    live = set(
        session.scalars(
            select(AppUser.id).where(
                AppUser.id.in_(ids),
                AppUser.is_suspended.is_(False),
                AppUser.provider_state == "active",
            )
        )
    )
    return [user_id for user_id in ids if user_id in live]


def _support_plan(session: Session, event: OutboxEvent):
    """Who hears about a support update and what they are told, decided from stored facts only."""
    update = session.get(SupportCaseUpdate, UUID(str(event.payload.get("update_id"))))
    case = session.get(SupportCase, event.aggregate_id)
    if update is None or case is None or update.case_id != case.id:
        raise ValueError("Support outbox reference is invalid")
    staff = session.scalars(
        select(CompanyMembership.user_id).where(
            CompanyMembership.company_id == case.company_id,
            CompanyMembership.status == "active",
            CompanyMembership.role.in_(("company_admin", "sales")),
        )
    ).all()
    technicians = session.scalars(
        select(SupportCaseAssignment.technician_id)
        .join(
            CompanyMembership,
            (CompanyMembership.user_id == SupportCaseAssignment.technician_id)
            & (CompanyMembership.company_id == case.company_id),
        )
        .where(
            SupportCaseAssignment.case_id == case.id,
            CompanyMembership.status == "active",
            CompanyMembership.role == "technician",
        )
    ).all()
    if update.kind in {"assigned", "unassigned"}:
        # Only the technician concerned is told about their own assignment.
        recipients = [update.subject_id] if update.subject_id else []
        title = (
            "Support request assigned to you"
            if update.kind == "assigned"
            else "Removed from a support request"
        )
        body = "Open it to see the problem reported."
    else:
        recipients = list(staff) + list(technicians)
        if update.shared:
            recipients.append(case.customer_id)
        title = (
            "Support request status changed"
            if update.kind == "status"
            else "New update on a support request"
        )
        body = "Open the support request to read it."
    # The person who made the change already knows.
    recipients = [user_id for user_id in recipients if user_id != update.actor_id]
    return _active(session, recipients), title, body, "support_case", case.id


def process_workflow_event(session: Session, event_key: str, storage=None) -> bool:
    """Return False for replay; store failure state and let Inngest retry errors."""
    event = session.scalars(
        select(OutboxEvent).where(OutboxEvent.event_key == event_key).with_for_update()
    ).one_or_none()
    if event is None:
        raise ValueError("Outbox event was not found")
    if event.status == "delivered":
        return False
    try:
        if event.event_type == EXPORT_EVENT:
            if storage is None:
                raise RuntimeError("Private storage is required for exports")
            build_export(session, UUID(str(event.payload.get("export_id"))), storage)
            recipient_ids, title, body, target_kind, target_id = [], "", "", "", None
        elif event.event_type == SUPPORT_EVENT:
            recipient_ids, title, body, target_kind, target_id = _support_plan(session, event)
        else:
            recipient_ids = _recipients(session, event)
            title, body = (
                ("Quotation accepted", "A quotation was accepted for your installation.")
                if event.event_type == "quotation.accepted"
                else ("Installation progress updated", "An installation milestone was updated.")
            )
            target_kind, target_id = "installation", event.aggregate_id
        for recipient_id in recipient_ids:
            session.execute(
                insert(Notification)
                .values(
                    recipient_id=recipient_id,
                    dedupe_key=f"{event.event_key}:{recipient_id}",
                    kind=event.event_type,
                    title=title,
                    body=body,
                    target_kind=target_kind,
                    target_id=target_id,
                )
                .on_conflict_do_nothing(index_elements=["dedupe_key"])
            )
        event.status = "delivered"
        event.processed_at = datetime.now(UTC)
        event.last_error = None
        event.attempts += 1
        session.commit()
        return True
    except Exception as error:
        session.rollback()
        failed = session.scalars(
            select(OutboxEvent).where(OutboxEvent.event_key == event_key).with_for_update()
        ).one()
        failed.status = "failed"
        failed.attempts += 1
        failed.last_error = type(error).__name__
        session.commit()
        raise
