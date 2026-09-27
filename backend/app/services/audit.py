"""Audit writes join the mutation transaction; no independent commits or raw metadata."""

from enum import StrEnum
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


class AuditAction(StrEnum):
    MEMBERSHIP_ASSIGNED = "membership.assigned"
    COMPANY_UPDATED = "company.updated"
    COMPANY_SUBMITTED = "company.submitted"
    COMPANY_APPROVED = "company.approved"
    COMPANY_REJECTED = "company.rejected"


def record_audit(
    session: Session, *, actor_id: UUID, company_id: UUID, target_id: UUID, action: AuditAction
) -> None:
    if not isinstance(action, AuditAction):
        raise ValueError("Audit action must be a predefined action")
    session.add(
        AuditEvent(
            actor_id=actor_id, company_id=company_id, target_id=target_id, action=action.value
        )
    )
