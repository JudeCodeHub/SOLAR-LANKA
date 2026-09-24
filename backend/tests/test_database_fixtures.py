"""Verify outer rollback, including commits performed inside sessions and API handlers."""

from collections.abc import Iterator
from typing import Annotated
from uuid import uuid4

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

from app.db.session import get_session

pytestmark = pytest.mark.database


@pytest.fixture
def probe_table(database_engine: Engine) -> Iterator[str]:
    name = f"fixture_probe_{uuid4().hex}"
    yield name
    # This fixture is requested before the session/client, so their rollback runs first.
    with database_engine.connect() as connection:
        assert connection.scalar(text("SELECT to_regclass(:name)"), {"name": name}) is None


def test_session_commit_does_not_escape_test_transaction(
    probe_table: str, database_session: Session
) -> None:
    database_session.execute(text(f'CREATE TABLE "{probe_table}" (value integer)'))
    database_session.execute(text(f'INSERT INTO "{probe_table}" VALUES (1)'))
    database_session.commit()
    assert database_session.scalar(text(f'SELECT count(*) FROM "{probe_table}"')) == 1


def test_session_rollback_allows_further_work_without_leaks(
    probe_table: str, database_session: Session
) -> None:
    database_session.execute(text(f'CREATE TABLE "{probe_table}" (value integer)'))
    database_session.commit()
    database_session.execute(text(f'INSERT INTO "{probe_table}" VALUES (1)'))
    database_session.rollback()
    assert database_session.scalar(text(f'SELECT count(*) FROM "{probe_table}"')) == 0
    database_session.execute(text(f'INSERT INTO "{probe_table}" VALUES (2)'))
    database_session.commit()


def test_api_commits_are_rolled_back_after_test(
    probe_table: str, database_client: TestClient
) -> None:
    @database_client.app.post("/fixture-probe")
    def create_probe(session: Annotated[Session, Depends(get_session)]) -> dict[str, int]:
        session.execute(text(f'CREATE TABLE "{probe_table}" (value integer)'))
        session.execute(text(f'INSERT INTO "{probe_table}" VALUES (1)'))
        session.commit()
        return {"count": 1}

    response = database_client.post("/fixture-probe")
    assert response.status_code == 200
    assert response.json() == {"count": 1}
