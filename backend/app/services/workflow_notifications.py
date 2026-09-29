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
from app.models.user import AppUser


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


def process_workflow_event(session: Session, event_key: str) -> bool:
    """Return False for replay; store failure state and let Inngest retry errors."""
    event = session.scalars(
        select(OutboxEvent).where(OutboxEvent.event_key == event_key).with_for_update()
    ).one_or_none()
    if event is None:
        raise ValueError("Outbox event was not found")
    if event.status == "delivered":
        return False
    try:
        recipient_ids = _recipients(session, event)
        title, body = (
            ("Quotation accepted", "A quotation was accepted for your installation.")
            if event.event_type == "quotation.accepted"
            else ("Installation progress updated", "An installation milestone was updated.")
        )
        for recipient_id in recipient_ids:
            session.execute(
                insert(Notification)
                .values(
                    recipient_id=recipient_id,
                    dedupe_key=f"{event.event_key}:{recipient_id}",
                    kind=event.event_type,
                    title=title,
                    body=body,
                    target_kind="installation",
                    target_id=event.aggregate_id,
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
