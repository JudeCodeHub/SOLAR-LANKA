"""Development and test only: turn pending outbox events into notifications without Inngest."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.outbox_event import OutboxEvent
from app.services.workflow_notifications import process_workflow_event


def process_pending(session: Session) -> int:
    """Process every event that has not been delivered; replays are harmless (they dedupe)."""
    keys = session.scalars(
        select(OutboxEvent.event_key)
        .where(OutboxEvent.status != "delivered")
        .order_by(OutboxEvent.created_at, OutboxEvent.id)
    ).all()
    for key in keys:
        process_workflow_event(session, key)
    return len(keys)


def main() -> None:
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("Local outbox processing requires development mode")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            print(f"processed {process_pending(session)}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
