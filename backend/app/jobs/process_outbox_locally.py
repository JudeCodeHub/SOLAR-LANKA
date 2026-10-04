"""Development and test only: turn pending outbox events into notifications without Inngest."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database_config import DatabaseSettings
from app.core.private_storage import LocalPrivateStorage
from app.db.session import create_database_engine
from app.models.outbox_event import OutboxEvent
from app.services.email_delivery import create_mailer
from app.services.workflow_notifications import process_workflow_event


def process_pending(session: Session, storage=None, mailer=None) -> int:
    """Process every event that has not been delivered; replays are harmless (they dedupe)."""
    keys = session.scalars(
        select(OutboxEvent.event_key)
        .where(OutboxEvent.status != "delivered")
        .order_by(OutboxEvent.created_at, OutboxEvent.id)
    ).all()
    for key in keys:
        process_workflow_event(session, key, storage, mailer)
    return len(keys)


def main() -> None:
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("Local outbox processing requires development mode")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            storage = LocalPrivateStorage(environment=settings.environment)
            print(f"processed {process_pending(session, storage, create_mailer(Settings()))}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
