"""Mail goes to a local sink by default, uses SMTP only when configured, and rejects injection."""

import stat

import pytest

from app.core.config import Settings
from app.services import mail as mail_module
from app.services.mail import Mail, SinkMailSender, SmtpMailSender, create_mail_sender


def settings(**values) -> Settings:
    return Settings(_env_file=None, environment="test", **values)


def test_sink_records_messages_privately_in_order(tmp_path):
    sender = create_mail_sender(settings(), tmp_path / "mail")
    assert isinstance(sender, SinkMailSender)
    sender.send(Mail("a@example.com", "First", "Hello"))
    sender.send(Mail("b@example.com", "Second", "World"))
    messages = sender.messages()
    assert [m["subject"] for m in messages] == ["First", "Second"]
    assert messages[0]["to"] == "a@example.com"
    assert messages[0]["from"].startswith("Solar Lanka")
    files = list((tmp_path / "mail").iterdir())
    assert all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in files)


@pytest.mark.parametrize(
    "mail",
    [
        Mail("a@example.com\nBcc: x@example.com", "Hi", "Body"),
        Mail("a@example.com", "Hi\r\nBcc: x@example.com", "Body"),
        Mail("not-an-address", "Hi", "Body"),
        Mail("a@example.com", " ", "Body"),
        Mail("a@example.com", "Hi", "  "),
    ],
)
def test_invalid_mail_is_refused_and_nothing_is_written(tmp_path, mail):
    sender = SinkMailSender("x@example.com", tmp_path / "mail")
    with pytest.raises(ValueError):
        sender.send(mail)
    assert sender.messages() == []


def test_smtp_sends_with_starttls_and_login(monkeypatch):
    calls = []

    class FakeSmtp:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port))

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self, context):
            calls.append(("starttls",))

        def login(self, user, password):
            calls.append(("login", user, password))

        def send_message(self, message):
            calls.append(("send", message["To"], message["Subject"], message.get_content().strip()))

    monkeypatch.setattr(mail_module.smtplib, "SMTP", FakeSmtp)
    sender = create_mail_sender(
        settings(
            mail_backend="smtp",
            smtp_host="mail.example.com",
            smtp_username="user",
            smtp_password="secret",
        )
    )
    assert isinstance(sender, SmtpMailSender)
    sender.send(Mail("a@example.com", "Hi", "Body"))
    assert calls == [
        ("connect", "mail.example.com", 587),
        ("starttls",),
        ("login", "user", "secret"),
        ("send", "a@example.com", "Hi", "Body"),
    ]


def test_configuration_errors_are_loud():
    with pytest.raises(RuntimeError):
        create_mail_sender(settings(mail_backend="smtp"))
    with pytest.raises(RuntimeError):
        create_mail_sender(Settings(_env_file=None, environment="production"))
    assert "hunter2" not in repr(settings(smtp_password="hunter2"))
