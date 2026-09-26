"""Atomic lifecycle updates; called only after webhook signature verification."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.account_lifecycle import (
    AccountAccessState,
    ProviderAccountState,
    apply_provider_state,
)
from app.models.lifecycle_event import LifecycleEvent
from app.models.user import AppUser


def synchronize_account(
    session: Session, event_id: str, subject: str, timestamp: int, incoming: ProviderAccountState
) -> None:
    receipt = session.scalar(
        insert(LifecycleEvent)
        .values(id=event_id)
        .on_conflict_do_nothing()
        .returning(LifecycleEvent.id)
    )
    if receipt is None:
        return
    # Insert tombstones even when deletion arrives before first sign-in.
    session.execute(
        insert(AppUser)
        .values(clerk_subject=subject, role="customer")
        .on_conflict_do_nothing(constraint="uq_app_users_clerk_subject")
    )
    user = session.scalars(
        select(AppUser).where(AppUser.clerk_subject == subject).with_for_update()
    ).one()
    # Deletion is terminal; equal-time conflicting events favour revocation.
    if incoming != ProviderAccountState.DELETED:
        if timestamp < user.provider_event_timestamp:
            return
        if timestamp == user.provider_event_timestamp and incoming == ProviderAccountState.ACTIVE:
            return
    state = apply_provider_state(
        AccountAccessState(ProviderAccountState(user.provider_state), user.is_suspended), incoming
    )
    user.provider_state = state.provider_state.value
    user.provider_event_timestamp = max(timestamp, user.provider_event_timestamp)
    session.flush()
