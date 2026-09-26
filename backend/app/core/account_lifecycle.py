"""Account lifecycle contract used by the verified synchronisation handler.

Only verified provider events or authorised local administration may change state.
A local suspension takes effect on the next protected request after commit, even
with an otherwise valid Clerk token. Provider revocation takes effect locally once
its verified event is committed; offline token verification cannot promise instant
revocation before delivery. Synchronisation retries must not restore access.

Deletion is a permanent tombstone: retain the local UUID and unique Clerk subject
so delayed events or old tokens cannot provision a replacement account. Preserve
historical ownership, quotations, installations, and audit references; do not hard
delete or cascade-delete business history. Profile PII removal is a separate,
explicit operation, not permission to remove these references.

Provider activation cannot clear an administrative suspension, restore a deleted
account, assign roles, or restore memberships. A new Clerk subject is a distinct
identity and must never inherit the deleted account's privileges. Events received
before initial provisioning must also retain revocation state (a tombstone).

The webhook handler verifies signatures and the instance, persists receipt IDs,
and orders transitions by event timestamp. Equal-time conflicts favour revocation.
"""

from dataclasses import dataclass, replace
from enum import StrEnum


class ProviderAccountState(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


@dataclass(frozen=True)
class AccountAccessState:
    provider_state: ProviderAccountState = ProviderAccountState.ACTIVE
    locally_suspended: bool = False

    @property
    def access_allowed(self) -> bool:
        return self.provider_state == ProviderAccountState.ACTIVE and not self.locally_suspended


def apply_provider_state(
    current: AccountAccessState, incoming: ProviderAccountState
) -> AccountAccessState:
    """Apply an already verified, ordered event without clearing local restrictions."""
    if not isinstance(incoming, ProviderAccountState):
        raise ValueError("Unknown provider account state")
    if current.provider_state == ProviderAccountState.DELETED:
        return current
    return replace(current, provider_state=incoming)
