"""Synchronous SQLAlchemy sessions; write services must commit explicitly."""

from collections.abc import Iterator

from fastapi import HTTPException, Request, status
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.database_config import DatabaseSettings


def create_database_engine(settings: DatabaseSettings) -> Engine:
    """Use psycopg with bounded connection attempts and checked pooled connections."""
    url = make_url(settings.connection_url.get_secret_value()).set(drivername="postgresql+psycopg")
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=5,
        connect_args={"connect_timeout": 5},
        hide_parameters=True,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    """Yield a request-local session; close also rolls back any uncommitted work."""
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured",
        )
    with factory() as session:
        yield session
