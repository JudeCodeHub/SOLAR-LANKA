"""The SMTP adapter delivers to a real SMTP server speaking the protocol over a local socket."""

import email
import smtplib
import socket
from email import policy

import pytest
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword

from app.core.config import Settings
from app.seed_demo import DEMO_CUSTOMER, seed_demo
from app.services.email_delivery import LocalEmailDirectory, Mailer, email_once
from app.services.mail import Mail, SmtpMailSender, create_mail_sender


class Inbox:
    """Keeps every message the server accepted."""

    def __init__(self) -> None:
        self.received: list = []

    async def handle_DATA(self, server, session, envelope):
        self.received.append(envelope)
        return "250 Message accepted"


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def authenticator(server, session, envelope, mechanism, auth_data):
    ok = isinstance(auth_data, LoginPassword) and auth_data.login == b"user"
    ok = ok and auth_data.password == b"secret"
    return AuthResult(success=ok, handled=False)


@pytest.fixture
def server():
    inbox = Inbox()
    port = free_port()
    controller = Controller(
        inbox,
        hostname="127.0.0.1",
        port=port,
        authenticator=authenticator,
        auth_required=False,
        auth_require_tls=False,
        ready_timeout=20,
    )
    controller.start()
    try:
        yield inbox, port
    finally:
        controller.stop()


def sender_for(port: int, **values) -> SmtpMailSender:
    settings = Settings(
        _env_file=None,
        environment="test",
        mail_backend="smtp",
        mail_from="Solar Lanka <no-reply@solarlanka.example>",
        smtp_host="127.0.0.1",
        smtp_port=port,
        smtp_starttls=False,
        **values,
    )
    sender = create_mail_sender(settings)
    assert isinstance(sender, SmtpMailSender)
    return sender


def test_a_message_sent_over_smtp_is_received_and_readable(server):
    inbox, port = server
    sender_for(port).send(Mail("ana@example.test", "Offer ready", "Line one\nLine two — Rs 5 000"))
    assert len(inbox.received) == 1
    envelope = inbox.received[0]
    assert envelope.rcpt_tos == ["ana@example.test"]
    message = email.message_from_bytes(envelope.content, policy=policy.default)
    assert message["To"] == "ana@example.test"
    assert message["Subject"] == "Offer ready"
    assert "no-reply@solarlanka.example" in message["From"]
    assert message.get_content().strip().splitlines() == ["Line one", "Line two — Rs 5 000"]


def test_login_is_used_and_wrong_credentials_deliver_nothing(server):
    inbox, port = server
    sender_for(port, smtp_username="user", smtp_password="secret").send(
        Mail("ana@example.test", "Hi", "Body")
    )
    assert len(inbox.received) == 1
    with pytest.raises(smtplib.SMTPAuthenticationError):
        sender_for(port, smtp_username="user", smtp_password="wrong").send(
            Mail("ana@example.test", "Hi", "Body")
        )
    assert len(inbox.received) == 1


def test_an_unreachable_server_raises_so_a_job_can_retry():
    with pytest.raises(OSError):
        sender_for(free_port()).send(Mail("ana@example.test", "Hi", "Body"))


def test_header_injection_never_reaches_the_server(server):
    inbox, port = server
    with pytest.raises(ValueError):
        sender_for(port).send(Mail("a@example.test\nBcc: x@example.test", "Hi", "Body"))
    assert inbox.received == []


@pytest.mark.database
def test_a_notification_email_goes_out_once_over_smtp(server, database_session):
    inbox, port = server
    seed_demo(database_session, environment="test")
    mailer = Mailer(sender_for(port), LocalEmailDirectory())
    customer_id, subject = DEMO_CUSTOMER
    args = {"recipient_id": customer_id, "dedupe_key": "smtp-1", "kind": "t", "body": "Body"}
    assert email_once(database_session, mailer, subject="One", **args) is True
    assert email_once(database_session, mailer, subject="One", **args) is False
    assert len(inbox.received) == 1
    assert inbox.received[0].rcpt_tos == [f"{subject}@example.test"]
