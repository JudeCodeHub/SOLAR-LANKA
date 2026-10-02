"""Scheduling inputs for site visits: explicit, validated, and independent of the web layer."""

from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "Asia/Colombo"
MAX_SLOTS = 3
MIN_NOTICE = timedelta(hours=24)
MAX_AHEAD = timedelta(days=90)
MIN_LENGTH = timedelta(minutes=30)
MAX_LENGTH = timedelta(hours=8)
# Visits happen in working hours in the visit's own time zone.
EARLIEST = time(7, 0)
LATEST = time(19, 0)


class SlotError(ValueError):
    """A scheduling input was refused; the message says which rule and which slot."""


@dataclass(frozen=True)
class Slot:
    starts_at: datetime
    ends_at: datetime


def load_zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError, ValueError, OSError:
        raise SlotError("Unknown time zone. Use an IANA name such as Asia/Colombo.") from None


def validate_slots(slots: list[Slot], zone_name: str, now: datetime) -> list[Slot]:
    """Return the slots in UTC, or raise SlotError naming the first rule they break."""
    if now.tzinfo is None:
        raise ValueError("now must carry a time zone")
    zone = load_zone(zone_name)
    if not 1 <= len(slots) <= MAX_SLOTS:
        raise SlotError(f"Give between 1 and {MAX_SLOTS} preferred slots.")
    cleaned: list[Slot] = []
    for number, slot in enumerate(slots, start=1):
        for label, moment in (("starts_at", slot.starts_at), ("ends_at", slot.ends_at)):
            if moment.tzinfo is None or moment.utcoffset() is None:
                raise SlotError(f"Slot {number}: {label} must include a UTC offset.")
        start, end = slot.starts_at.astimezone(UTC), slot.ends_at.astimezone(UTC)
        if end <= start:
            raise SlotError(f"Slot {number}: it must end after it starts.")
        if not MIN_LENGTH <= end - start <= MAX_LENGTH:
            raise SlotError(f"Slot {number}: it must last between 30 minutes and 8 hours.")
        if start < now + MIN_NOTICE:
            raise SlotError(f"Slot {number}: it must start at least 24 hours from now.")
        if start > now + MAX_AHEAD:
            raise SlotError(f"Slot {number}: it must start within 90 days.")
        local_start, local_end = start.astimezone(zone), end.astimezone(zone)
        if (
            local_start.date() != local_end.date()
            or local_start.time() < EARLIEST
            or local_end.time() > LATEST
        ):
            raise SlotError(
                f"Slot {number}: it must fall on one day between 07:00 and 19:00 in {zone_name}."
            )
        cleaned.append(Slot(start, end))
    ordered = sorted(cleaned, key=lambda item: item.starts_at)
    for earlier, later in zip(ordered, ordered[1:], strict=False):
        if later.starts_at < earlier.ends_at:
            raise SlotError("Preferred slots must not overlap each other.")
    return cleaned
