"""One-shot outbox dispatcher; callers schedule invocations explicitly."""

from collections.abc import Callable
from datetime import UTC, datetime

import inngest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.outbox_event import OutboxEvent


def dispatch_outbox(
    factory: Callable[[], Session], client: inngest.Inngest, *, limit: int = 50
) -> int:
    """Send pending rows with stable IDs; keep failed sends inspectable for retry."""
    sent = 0
    for _ in range(limit):
        with factory() as session:
            event = session.scalars(
                select(OutboxEvent)
                .where(OutboxEvent.dispatched_at.is_(None))
                .where(OutboxEvent.status.in_(("pending", "failed")))
                .order_by(OutboxEvent.created_at, OutboxEvent.id)
                .with_for_update(skip_locked=True)
                .limit(1)
            ).one_or_none()
            if event is None:
                break
            try:
                ids = client.send_sync(
                    inngest.Event(
                        id=event.event_key,
                        name="solar/workflow.outbox",
                        data={"event_key": event.event_key},
                    )
                )
                if not ids:
                    raise RuntimeError("Inngest did not acknowledge the event")
            except Exception as error:
                event.status = "failed"
                event.attempts += 1
                event.last_error = type(error).__name__
                session.commit()
                break
            event.status = "processing"
            event.dispatched_at = datetime.now(UTC)
            event.attempts += 1
            event.last_error = None
            session.commit()
            sent += 1
    return sent
