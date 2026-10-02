from app.core.site_visit_states import ALLOWED, can


def test_finished_visits_allow_nothing():
    for status in ("cancelled", "completed"):
        assert not any(can(action, status) for action in ALLOWED)


def test_each_action_is_only_possible_in_its_states():
    assert can("confirm", "requested") and not can("confirm", "confirmed")
    assert can("accept", "alternatives_offered") and not can("accept", "requested")
    assert can("propose", "confirmed") and not can("propose", "alternatives_offered")
    assert all(can("cancel", s) for s in ("requested", "alternatives_offered", "confirmed"))
