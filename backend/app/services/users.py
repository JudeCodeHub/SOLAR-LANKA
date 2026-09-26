"""Idempotent local user provisioning from server-verified identity."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import VerifiedIdentity
from app.core.permissions import Role
from app.models.user import AppUser


def provision_user(session: Session, identity: VerifiedIdentity) -> AppUser:
    """Provision within the caller's transaction, including concurrent first requests."""
    if not isinstance(identity, VerifiedIdentity):
        raise TypeError("A verified identity is required")
    if not identity.subject.strip() or len(identity.subject) > 255:
        raise ValueError("Invalid identity subject")
    session.execute(
        insert(AppUser)
        .values(clerk_subject=identity.subject, role=Role.CUSTOMER.value)
        .on_conflict_do_nothing(constraint="uq_app_users_clerk_subject")
    )
    return session.scalars(select(AppUser).where(AppUser.clerk_subject == identity.subject)).one()
