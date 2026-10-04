"""Transactional email behind one adapter; the default local sink needs no paid service."""

import json
import os
import smtplib
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.core.config import BACKEND_DIR, Settings

DEFAULT_SINK_DIR = BACKEND_DIR / "storage" / "mail"


@dataclass(frozen=True)
class Mail:
    to: str
    subject: str
    body: str


class MailSender(Protocol):
    def send(self, mail: Mail) -> None: ...


def check_mail(mail: Mail) -> None:
    """Reject anything that could inject headers or send an empty message."""
    for value in (mail.to, mail.subject):
        if not value.strip() or "\r" in value or "\n" in value:
            raise ValueError("Invalid mail header")
    if "@" not in mail.to or not mail.body.strip():
        raise ValueError("Invalid mail")


class SinkMailSender:
    """Writes each message as a private JSON file so development mail can be inspected."""

    def __init__(self, sender: str, directory: Path = DEFAULT_SINK_DIR) -> None:
        self.sender = sender
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)

    def send(self, mail: Mail) -> None:
        check_mail(mail)
        record = {
            "from": self.sender,
            "to": mail.to,
            "subject": mail.subject,
            "body": mail.body,
            "written_at": datetime.now(UTC).isoformat(),
        }
        path = self.directory / f"{uuid4().hex}.json"
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(record, stream)

    def messages(self) -> list[dict]:
        files = sorted(self.directory.glob("*.json"))
        records = [json.loads(path.read_text(encoding="utf-8")) for path in files]
        return sorted(records, key=lambda record: record["written_at"])


class SmtpMailSender:
    def __init__(self, settings: Settings) -> None:
        if settings.smtp_host is None:
            raise RuntimeError("SOLAR_SMTP_HOST is required for smtp mail")
        self.settings = settings

    def send(self, mail: Mail) -> None:
        check_mail(mail)
        settings = self.settings
        message = EmailMessage()
        message["From"] = settings.mail_from
        message["To"] = mail.to
        message["Subject"] = mail.subject
        message.set_content(mail.body)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
            if settings.smtp_starttls:
                client.starttls(context=ssl.create_default_context())
            if settings.smtp_username and settings.smtp_password:
                client.login(settings.smtp_username, settings.smtp_password.get_secret_value())
            client.send_message(message)


def create_mail_sender(settings: Settings, directory: Path = DEFAULT_SINK_DIR) -> MailSender:
    if settings.mail_backend == "smtp":
        return SmtpMailSender(settings)
    if settings.environment == "production":
        raise RuntimeError("Production mail requires SOLAR_MAIL_BACKEND=smtp")
    return SinkMailSender(settings.mail_from, directory)
