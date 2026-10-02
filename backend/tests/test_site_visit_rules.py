"""Scheduling inputs follow explicit rules about time zones, notice, length and working hours."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.site_visit_rules import Slot, SlotError, validate_slots

NOW = datetime(2026, 10, 1, 4, 0, tzinfo=UTC)  # 09:30 in Colombo
ZONE = "Asia/Colombo"  # UTC+05:30, no daylight saving


def slot(day: int, hour: int, minutes: int = 120, offset: str = "+05:30") -> Slot:
    start = datetime.fromisoformat(f"2026-10-{day:02d}T{hour:02d}:00:00{offset}")
    return Slot(start, start + timedelta(minutes=minutes))


def refused(slots, zone=ZONE, match=""):
    with pytest.raises(SlotError, match=match):
        validate_slots(slots, zone, NOW)


def test_good_slots_come_back_in_utc():
    result = validate_slots([slot(5, 9), slot(6, 14)], ZONE, NOW)
    assert [s.starts_at for s in result] == [
        datetime(2026, 10, 5, 3, 30, tzinfo=UTC),
        datetime(2026, 10, 6, 8, 30, tzinfo=UTC),
    ]


def test_counts_and_zone():
    refused([], match="between 1 and 3")
    refused([slot(5, 9), slot(6, 9), slot(7, 9), slot(8, 9)], match="between 1 and 3")
    refused([slot(5, 9)], zone="Mars/Olympus", match="Unknown time zone")


def test_every_instant_must_state_its_offset():
    naive = Slot(datetime(2026, 10, 5, 9), datetime(2026, 10, 5, 11))
    refused([naive], match="UTC offset")


def test_length_notice_and_horizon():
    refused([slot(5, 9, minutes=15)], match="30 minutes and 8 hours")
    refused([slot(5, 8, minutes=9 * 60)], match="30 minutes and 8 hours")
    refused([slot(2, 9)], match="24 hours")  # tomorrow morning is under a day away
    refused([Slot(NOW + timedelta(days=91), NOW + timedelta(days=91, hours=2))], match="90 days")


def test_working_hours_are_judged_in_the_visits_own_zone():
    refused([slot(5, 6)], match="07:00 and 19:00")
    refused([slot(5, 18, minutes=120)], match="07:00 and 19:00")
    # The same instants written in UTC are accepted when they fall inside local working hours.
    inside = Slot(datetime(2026, 10, 5, 4, 0, tzinfo=UTC), datetime(2026, 10, 5, 6, 0, tzinfo=UTC))
    assert validate_slots([inside], ZONE, NOW)
    # ...and refused in a zone where they are the middle of the night.
    refused([inside], zone="America/Los_Angeles", match="07:00 and 19:00")


def test_slots_must_end_after_starting_and_not_overlap():
    backwards = Slot(slot(5, 9).ends_at, slot(5, 9).starts_at)
    refused([backwards], match="end after")
    refused([slot(5, 9), slot(5, 10)], match="overlap")  # 09-11 and 10-12
    assert validate_slots([slot(5, 9), slot(5, 11)], ZONE, NOW)  # touching is fine
