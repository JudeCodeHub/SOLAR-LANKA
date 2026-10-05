"""The reminder job is registered with Inngest on an hourly schedule and runs the same checks."""

from unittest.mock import MagicMock

from app.core.config import Settings
from app.services.inngest_workflow import (
    REMINDER_CRON,
    create_inngest_client,
    create_reminder_function,
)


def test_reminders_are_scheduled_hourly_and_use_the_shared_job():
    client = create_inngest_client(Settings(_env_file=None, environment="test"))
    function = create_reminder_function(client, MagicMock())
    config = function.get_config("http://localhost")
    triggers = list(config.main.triggers)
    assert [trigger.cron for trigger in triggers] == [REMINDER_CRON]
    assert function.id == "solarlanka-send-reminders"
    assert REMINDER_CRON == "0 * * * *"


def test_export_cleanup_is_scheduled_daily():
    from app.services.inngest_workflow import CLEANUP_CRON, create_cleanup_function

    client = create_inngest_client(Settings(_env_file=None, environment="test"))
    function = create_cleanup_function(client, MagicMock(), MagicMock())
    config = function.get_config("http://localhost")
    assert [trigger.cron for trigger in config.main.triggers] == [CLEANUP_CRON]
    assert function.id == "solarlanka-cleanup-exports"
    assert CLEANUP_CRON == "0 3 * * *"
