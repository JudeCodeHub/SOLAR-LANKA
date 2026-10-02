"""Which action is allowed in which site visit state, and who may take it."""

from typing import Literal

Status = Literal["requested", "alternatives_offered", "confirmed", "cancelled", "completed"]
Action = Literal["confirm", "propose", "accept", "cancel", "reschedule"]

ALLOWED: dict[Action, frozenset[str]] = {
    # Company staff: confirm one of the customer's slots, or offer other slots.
    "confirm": frozenset({"requested"}),
    "propose": frozenset({"requested", "confirmed"}),
    # Customer: take one of the company's proposed slots, or ask again with new slots.
    "accept": frozenset({"alternatives_offered"}),
    "reschedule": frozenset({"requested", "alternatives_offered", "confirmed"}),
    # Either side, until the visit has been done.
    "cancel": frozenset({"requested", "alternatives_offered", "confirmed"}),
}


def can(action: Action, status: str) -> bool:
    return status in ALLOWED[action]
