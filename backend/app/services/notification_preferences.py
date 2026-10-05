"""Read a person's switches; anyone without a saved row has everything on."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification_preference import NotificationPreference


def preferences_for(session: Session, user_id: UUID) -> tuple[bool, bool]:
    """Return (reminders_enabled, email_enabled)."""
    row = session.get(NotificationPreference, user_id)
    return (True, True) if row is None else (row.reminders_enabled, row.email_enabled)
