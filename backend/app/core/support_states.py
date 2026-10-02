"""Support case statuses and who may move a case between them."""

from typing import Literal

Role = Literal["customer", "staff"]

# (from, to) pairs each side may take. A closed case never moves again.
MOVES: dict[Role, frozenset[tuple[str, str]]] = {
    "staff": frozenset(
        {
            ("open", "in_progress"),
            ("in_progress", "resolved"),
            ("resolved", "in_progress"),
            ("open", "closed"),
            ("in_progress", "closed"),
            ("resolved", "closed"),
        }
    ),
    "customer": frozenset(
        {
            ("open", "closed"),
            ("in_progress", "closed"),
            ("resolved", "closed"),
            ("resolved", "open"),  # the customer says it is not fixed
        }
    ),
}
# Closing without a resolution must say why, so nobody is left wondering.
NEEDS_REASON = frozenset({("open", "closed"), ("in_progress", "closed")})


def can_move(role: Role, current: str, target: str) -> bool:
    return (current, target) in MOVES[role]


def needs_reason(role: Role, current: str, target: str) -> bool:
    return role == "staff" and (current, target) in NEEDS_REASON
