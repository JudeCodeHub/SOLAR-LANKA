"""Run once with: .venv/bin/python -m app.jobs.dispatch_outbox"""

from app.core.config import Settings
from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine, create_session_factory
from app.services.inngest_workflow import create_inngest_client
from app.services.outbox_dispatch import dispatch_outbox


def main() -> None:
    settings = Settings()
    database_settings = DatabaseSettings(_env_file=None, **settings.model_dump())
    engine = create_database_engine(database_settings)
    try:
        sent = dispatch_outbox(create_session_factory(engine), create_inngest_client(settings))
        print(f"Dispatched {sent} workflow events")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
