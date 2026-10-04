"""Run the reminder checks once; schedule it (cron or Inngest) as often as needed."""

from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.services.reminders import run_reminders


def main() -> None:
    engine = create_database_engine(DatabaseSettings())
    try:
        with Session(engine) as session:
            print(run_reminders(session))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
