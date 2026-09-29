"""Official Inngest SDK integration for durable notification processing."""

from collections.abc import Callable

import inngest
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.services.workflow_notifications import process_workflow_event


def create_inngest_client(settings: Settings) -> inngest.Inngest:
    return inngest.Inngest(
        app_id="solarlanka",
        is_production=settings.environment == "production",
        event_key=(
            settings.inngest_event_key.get_secret_value() if settings.inngest_event_key else None
        ),
        signing_key=(
            settings.inngest_signing_key.get_secret_value()
            if settings.inngest_signing_key
            else None
        ),
    )


def create_notification_function(client: inngest.Inngest, factory: Callable[[], Session]):
    @client.create_function(
        fn_id="process-workflow-notification",
        trigger=inngest.TriggerEvent(event="solar/workflow.outbox"),
        retries=4,
    )
    def process_notification(ctx: inngest.Context) -> str:
        event_key = ctx.event.data.get("event_key")
        if not isinstance(event_key, str) or not event_key:
            raise ValueError("Missing outbox event key")

        def persist() -> bool:
            with factory() as session:
                return process_workflow_event(session, event_key)

        ctx.step.run("persist-notifications", persist)
        return "processed"

    return process_notification
