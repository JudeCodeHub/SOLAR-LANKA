from typing import Annotated
from unittest.mock import MagicMock

import pytest
from fastapi import Depends, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_session
from app.main import create_app


def test_unconfigured_database_does_not_break_liveness(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is not configured"}


def test_readiness_hides_database_error_details(client: TestClient) -> None:
    engine = MagicMock()
    engine.connect.side_effect = OperationalError("SELECT 1", {}, Exception("private-host-secret"))
    client.app.state.database_engine = engine
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}


@pytest.mark.parametrize("fail", [False, True])
def test_session_context_is_released_on_success_and_failure(fail: bool) -> None:
    app = create_app(Settings(_env_file=None, environment="test"))
    contexts = [MagicMock(), MagicMock()]
    factory = MagicMock(side_effect=contexts)
    seen = []

    @app.get("/session-probe")
    def probe(session: Annotated[Session, Depends(get_session)]) -> dict[str, bool]:
        seen.append(session)
        if fail:
            raise HTTPException(status_code=409, detail="Expected failure")
        return {"ok": True}

    with TestClient(app) as client:
        app.state.session_factory = factory
        for _ in range(2):
            assert client.get("/session-probe").status_code == (409 if fail else 200)

    assert factory.call_count == 2
    assert seen[0] is not seen[1]
    for context in contexts:
        context.__exit__.assert_called_once()
        context.__enter__.return_value.commit.assert_not_called()


def test_application_disposes_engine_on_shutdown(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import main

    engine = MagicMock()
    monkeypatch.setattr(main, "create_database_engine", lambda settings: engine)
    app = create_app(
        Settings(
            _env_file=None,
            environment="test",
            test_database_url="postgresql://solarlanka_test:dummy@127.0.0.1:5433/solarlanka_test",
        )
    )
    with TestClient(app):
        assert app.state.database_engine is engine
    engine.dispose.assert_called_once()
    assert app.state.database_engine is None
