from dataclasses import FrozenInstanceError

import pytest

from app.core.permissions import PERMISSION_MATRIX, Action, Grant, Role, Scope, required_scopes


def test_every_declared_action_has_an_actor_and_scope() -> None:
    assert set(PERMISSION_MATRIX) == set(Action)
    for grants in PERMISSION_MATRIX.values():
        assert grants
        assert all(
            isinstance(grant.role, Role) and isinstance(grant.scope, Scope) for grant in grants
        )
        assert len(grants) == len(set(grants))


def test_unknown_roles_actions_and_visitors_are_denied() -> None:
    assert not required_scopes("unrecognised.action", Role.PLATFORM_ADMIN)
    assert not required_scopes(Action.QUOTATION_ACCEPT, "super_admin")
    assert all(not required_scopes(action, Role.VISITOR) for action in Action)


def test_only_request_owner_can_accept_or_compare_competing_quotes() -> None:
    for action in (Action.QUOTATION_ACCEPT, Action.QUOTATION_COMPARE):
        assert required_scopes(action, Role.CUSTOMER) == {Scope.OWNER}
        for role in (Role.COMPANY_ADMIN, Role.SALES, Role.TECHNICIAN, Role.PLATFORM_ADMIN):
            assert not required_scopes(action, role)


def test_company_access_is_limited_to_its_recipient_delivery() -> None:
    assert required_scopes(Action.QUOTATION_READ, Role.SALES) == {Scope.DELIVERY_COMPANY}
    assert required_scopes(Action.DELIVERY_READ, Role.COMPANY_ADMIN) == {Scope.DELIVERY_COMPANY}
    assert not required_scopes(Action.REQUEST_READ, Role.SALES)
    assert not required_scopes(Action.COMPANY_NOTE_READ, Role.CUSTOMER)


def test_technician_is_assignment_scoped_and_cannot_assign_or_sell() -> None:
    assert required_scopes(Action.INSTALLATION_UPDATE, Role.TECHNICIAN) == {Scope.ASSIGNED_JOB}
    assert required_scopes(Action.ATTACHMENT_DOWNLOAD, Role.TECHNICIAN) == {Scope.ASSIGNED_PARENT}
    assert not required_scopes(Action.INSTALLATION_ASSIGN, Role.TECHNICIAN)
    assert not required_scopes(Action.QUOTATION_SEND, Role.TECHNICIAN)


def test_staff_cannot_manage_platform_or_other_users_accounts() -> None:
    assert required_scopes(Action.ACCOUNT_UPDATE, Role.SALES) == {Scope.SELF}
    assert not required_scopes(Action.MEMBERSHIP_MANAGE, Role.SALES)
    assert not required_scopes(Action.USER_STATUS_MANAGE, Role.COMPANY_ADMIN)
    assert not required_scopes(Action.CALCULATION_CONFIG_PUBLISH, Role.COMPANY_ADMIN)
    assert not required_scopes(Action.COMPANY_REVIEW, Role.COMPANY_ADMIN)


def test_platform_role_does_not_grant_blanket_access_to_private_files() -> None:
    assert required_scopes(Action.AUDIT_READ, Role.PLATFORM_ADMIN) == {Scope.PLATFORM}
    assert not required_scopes(Action.ATTACHMENT_DOWNLOAD, Role.PLATFORM_ADMIN)
    assert not required_scopes(Action.INSTALLATION_INTERNAL_NOTE, Role.CUSTOMER)


def test_policy_cannot_be_mutated_at_runtime() -> None:
    with pytest.raises(TypeError):
        PERMISSION_MATRIX[Action.QUOTATION_ACCEPT] = ()
    grant = Grant(Role.CUSTOMER, Scope.OWNER)
    with pytest.raises(FrozenInstanceError):
        grant.scope = Scope.PLATFORM
