"""Run with --database against the dedicated PostgreSQL test service only."""

from typing import Annotated

import pytest
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import get_session
from app.main import create_app

pytestmark = pytest.mark.database


def test_real_database_readiness_and_identity(database_settings: DatabaseSettings) -> None:
    with TestClient(create_app(database_settings)) as client:
        assert client.get("/health/ready").json() == {"status": "ok", "database": "ok"}
        with client.app.state.database_engine.connect() as connection:
            database, user = connection.execute(
                text("SELECT current_database(), current_user")
            ).one()
            assert (database, user) == ("solarlanka_test", "solarlanka_test")


def test_request_failure_rolls_back_and_releases_connection(
    database_settings: DatabaseSettings,
) -> None:
    app = create_app(database_settings)

    @app.post("/rollback-probe")
    def probe(session: Annotated[Session, Depends(get_session)]) -> None:
        session.execute(text("CREATE TEMP TABLE rollback_probe (value integer) ON COMMIT DROP"))
        session.execute(text("INSERT INTO rollback_probe VALUES (1)"))
        raise HTTPException(status_code=409, detail="Expected rollback")

    with TestClient(app) as client:
        for _ in range(2):
            assert client.post("/rollback-probe").status_code == 409
            engine = app.state.database_engine
            assert engine.pool.checkedout() == 0
            with engine.connect() as connection:
                assert (
                    connection.scalar(text("SELECT to_regclass('pg_temp.rollback_probe')")) is None
                )
