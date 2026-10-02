from app.core.support_states import can_move, needs_reason


def test_staff_work_the_case_forward_and_customers_can_reopen_or_close():
    assert can_move("staff", "open", "in_progress") and can_move("staff", "resolved", "in_progress")
    assert not can_move("staff", "open", "resolved")  # work comes first
    assert can_move("customer", "resolved", "open") and can_move("customer", "open", "closed")
    assert not can_move("customer", "open", "in_progress")  # only the company starts work


def test_a_closed_case_never_moves_and_closing_early_needs_a_reason():
    for role in ("staff", "customer"):
        assert not any(can_move(role, "closed", t) for t in ("open", "in_progress", "resolved"))
    assert needs_reason("staff", "open", "closed")
    assert not needs_reason("staff", "resolved", "closed")
    assert not needs_reason("customer", "open", "closed")
