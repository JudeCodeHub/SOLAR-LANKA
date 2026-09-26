"""Executable access-revocation and retention policy examples."""

import pytest

from app.core.account_lifecycle import (
    AccountAccessState,
    ProviderAccountState,
    apply_provider_state,
)


@pytest.mark.parametrize("state", list(ProviderAccountState))
@pytest.mark.parametrize("local_suspension", [False, True])
def test_access_requires_both_provider_and_local_approval(state, local_suspension):
    account = AccountAccessState(state, local_suspension)
    assert account.access_allowed == (
        state == ProviderAccountState.ACTIVE and not local_suspension
    )


@pytest.mark.parametrize("incoming", list(ProviderAccountState))
def test_deletion_is_terminal_and_replays_are_safe(incoming):
    deleted = apply_provider_state(AccountAccessState(), ProviderAccountState.DELETED)
    assert apply_provider_state(deleted, incoming) == deleted
    assert not deleted.access_allowed


def test_provider_reactivation_preserves_local_suspension():
    suspended = AccountAccessState(ProviderAccountState.SUSPENDED, locally_suspended=True)
    activated = apply_provider_state(suspended, ProviderAccountState.ACTIVE)
    assert activated.locally_suspended
    assert not activated.access_allowed


def test_provider_suspension_can_be_lifted_without_local_restriction():
    suspended = apply_provider_state(AccountAccessState(), ProviderAccountState.SUSPENDED)
    assert not suspended.access_allowed
    assert apply_provider_state(suspended, ProviderAccountState.ACTIVE).access_allowed


def test_unknown_provider_state_is_rejected():
    with pytest.raises(ValueError):
        apply_provider_state(AccountAccessState(), "unknown")
