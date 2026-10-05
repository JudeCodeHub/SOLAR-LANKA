"""Email a notification once per message, to the address its owner keeps with Clerk."""

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from clerk_backend_api import Clerk
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.email_delivery import EmailDelivery
from app.models.user import AppUser
from app.services.mail import Mail, MailSender, create_mail_sender
from app.services.notification_preferences import preferences_for


class EmailDirectory(Protocol):
    def address_for(self, clerk_subject: str) -> str | None: ...


class LocalEmailDirectory:
    """Development and tests: a reserved, never-routable address derived from the subject."""

    def address_for(self, clerk_subject: str) -> str | None:
        return f"{clerk_subject}@example.test"


class ClerkEmailDirectory:
    """Production: the primary email address Clerk holds; this app never stores addresses."""

    def __init__(self, secret_key: str) -> None:
        self.client = Clerk(bearer_auth=secret_key)

    def address_for(self, clerk_subject: str) -> str | None:
        user = self.client.users.get(user_id=clerk_subject)
        for address in user.email_addresses or []:
            if address.id == user.primary_email_address_id:
                return address.email_address
        return None


@dataclass(frozen=True)
class Mailer:
    sender: MailSender
    directory: EmailDirectory


def create_mailer(settings: Settings) -> Mailer:
    sender = create_mail_sender(settings)
    if settings.mail_backend == "smtp":
        if settings.clerk_secret_key is None:
            raise RuntimeError("SOLAR_CLERK_SECRET_KEY is required to look up email addresses")
        return Mailer(sender, ClerkEmailDirectory(settings.clerk_secret_key.get_secret_value()))
    return Mailer(sender, LocalEmailDirectory())


def email_once(
    session: Session,
    mailer: Mailer,
    *,
    recipient_id: UUID,
    dedupe_key: str,
    kind: str,
    subject: str,
    body: str,
) -> bool:
    """Send at most one email per key; a failed send leaves no record so a retry sends it."""
    user = session.scalars(
        select(AppUser).where(
            AppUser.id == recipient_id,
            AppUser.is_suspended.is_(False),
            AppUser.provider_state == "active",
        )
    ).one_or_none()
    if user is None or not preferences_for(session, recipient_id)[1]:
        return False
    address = mailer.directory.address_for(user.clerk_subject)
    if address is None:
        return False
    with session.begin_nested():
        recorded = session.scalar(
            insert(EmailDelivery)
            .values(recipient_id=recipient_id, dedupe_key=dedupe_key, kind=kind)
            .on_conflict_do_nothing(constraint="uq_email_deliveries_dedupe_key")
            .returning(EmailDelivery.id)
        )
        if recorded is None:
            return False
        text = f"{body}\n\nOpen Solar Lanka to see it. This is a fictional portfolio demo."
        mailer.sender.send(Mail(to=address, subject=subject, body=text))
    return True
