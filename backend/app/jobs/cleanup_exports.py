"""Run the export cleanup once; schedule it daily (Inngest or cron)."""

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database_config import DatabaseSettings
from app.core.private_storage import LocalPrivateStorage
from app.db.session import create_database_engine
from app.services.quotation_export import cleanup_exports


def main() -> None:
    engine = create_database_engine(DatabaseSettings())
    try:
        storage = LocalPrivateStorage(environment=Settings().environment)
        with Session(engine) as session:
            print(cleanup_exports(session, storage))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
