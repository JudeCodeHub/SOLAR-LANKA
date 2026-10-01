"""Account lifecycle contract used by the verified synchronisation handler."""

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
