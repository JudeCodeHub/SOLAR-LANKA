"""Arcjet rules, outage behaviour and route coverage, without calling the Arcjet service."""

import asyncio
import logging
from dataclasses import replace
from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.errors import register_error_handlers
from app.api.routes.estimates import router as estimates_router
from app.api.routes.media_uploads import router as media_router
from app.api.routes.quotation_requests import router as requests_router
from app.api.routes.saved_estimates import router as saved_estimates_router
from app.core.auth import VerifiedIdentity, require_identity
from app.core.config import Settings
from app.core.request_protection import (
    ESTIMATE_PREVIEW,
    POLICIES,
    QUOTATION_REQUEST_WRITE,
    close_protection_clients,
    create_protection_clients,
    protect_ip,
    protect_user,
)
from app.main import create_app

SECRET_MARKER = "do-not-log-this"


class FakeClient:
    """Stands in for an Arcjet client; records how protect() was called."""

    def __init__(self, *, denied=False, reason="RATE_LIMIT", error=False, raises=False):
        self.denied, self.reason, self.error, self.raises = denied, reason, error, raises
        self.calls = []

    async def protect(self, request, *, characteristics=None):
        self.calls.append(characteristics)
        if self.raises:
            raise RuntimeError(SECRET_MARKER)
        return SimpleNamespace(
            is_error=lambda: self.error,
            is_denied=lambda: self.denied,
            reason_v2=SimpleNamespace(type=self.reason),
        )


def protected_app(policy, client, *, user_keyed=False):
    app = FastAPI()
    register_error_handlers(app)
    app.state.arcjet_clients = None if client is None else {policy.name: client}
    dependency = protect_user(policy) if user_keyed else protect_ip(policy)

    @app.post("/protected", dependencies=[Depends(dependency)])
    def protected():
        return {"ok": True}

    app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject="user_123", session_id="sess_1"
    )
    return app


def user_policy(**changes):
    return replace(QUOTATION_REQUEST_WRITE, **changes)


def test_disabled_protection_allows_requests():
    app = protected_app(ESTIMATE_PREVIEW, None)
    assert TestClient(app).post("/protected").status_code == 200


def test_allowed_request_passes_ip_keyed_without_user_characteristic():
    client = FakeClient()
    response = TestClient(protected_app(ESTIMATE_PREVIEW, client)).post("/protected")
    assert response.status_code == 200
    assert client.calls == [None]


def test_user_keyed_policy_limits_by_verified_subject_only():
    client = FakeClient()
    app = protected_app(QUOTATION_REQUEST_WRITE, client, user_keyed=True)
    response = TestClient(app).post("/protected", headers={"X-User-Id": "someone_else"})
    assert response.status_code == 200
    assert client.calls == [{"userId": "user_123"}]


def test_rate_limit_denial_uses_error_contract_and_retry_after():
    client = FakeClient(denied=True)
    response = TestClient(protected_app(ESTIMATE_PREVIEW, client)).post("/protected")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert response.headers["retry-after"] == str(ESTIMATE_PREVIEW.window_seconds)


def test_bot_denial_is_forbidden_without_retry_after():
    client = FakeClient(denied=True, reason="BOT")
    response = TestClient(protected_app(ESTIMATE_PREVIEW, client)).post("/protected")
    assert response.status_code == 403
    assert "retry-after" not in response.headers


@pytest.mark.parametrize("failure", [{"error": True}, {"raises": True}])
def test_provider_failure_fails_open_by_default(failure, caplog):
    client = FakeClient(**failure)
    with caplog.at_level(logging.WARNING):
        response = TestClient(protected_app(ESTIMATE_PREVIEW, client)).post("/protected")
    assert response.status_code == 200
    assert "Arcjet protection error on estimate_preview" in caplog.text
    assert SECRET_MARKER not in caplog.text


@pytest.mark.parametrize("failure", [{"error": True}, {"raises": True}])
def test_fail_closed_policy_rejects_on_provider_failure(failure):
    policy = user_policy(fail_open=False)
    client = FakeClient(**failure)
    response = TestClient(protected_app(policy, client, user_keyed=True)).post("/protected")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_user_policy_rejects_missing_identity_before_calling_arcjet():
    client = FakeClient()
    app = protected_app(QUOTATION_REQUEST_WRITE, client, user_keyed=True)
    app.dependency_overrides.clear()
    response = TestClient(app).post("/protected")
    assert response.status_code == 401
    assert client.calls == []


def test_no_key_disables_protection_outside_production(caplog):
    settings = Settings(_env_file=None, environment="development")
    with caplog.at_level(logging.WARNING):
        assert create_protection_clients(settings) is None
    assert "SOLAR_ARCJET_KEY is not set" in caplog.text


def test_production_requires_an_arcjet_key():
    settings = Settings(
        _env_file=None,
        environment="production",
        inngest_event_key="event",
        inngest_signing_key="signing",
    )
    with pytest.raises(RuntimeError, match="Arcjet key is required"):
        create_app(settings)


def test_configured_key_builds_one_client_per_policy_and_closes_cleanly():
    settings = Settings(_env_file=None, environment="test", arcjet_key="ajkey_dummy_value")
    clients = create_protection_clients(settings)
    assert {policy.name for policy in POLICIES} <= set(clients)
    asyncio.run(close_protection_clients(clients))
    asyncio.run(close_protection_clients(None))


def test_timeout_is_bounded_and_secret_is_hidden():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="test", arcjet_timeout_ms=50)
    settings = Settings(_env_file=None, environment="test", arcjet_key=SECRET_MARKER)
    assert SECRET_MARKER not in repr(settings)


PROTECTED = {
    ("POST", "/estimates/preview"),
    ("POST", "/users/me/estimates"),
    ("POST", "/users/me/requests"),
    ("POST", "/media/upload-requests"),
}
# State-changing routes on these routers that are deliberately not rate limited.
EXEMPT = {
    ("POST", "/users/me/requests/{request_id}/withdraw"),
    ("POST", "/media/attachments"),
}


def mutating_routes():
    for router in (estimates_router, saved_estimates_router, requests_router, media_router):
        for route in router.routes:
            assert isinstance(route, APIRoute)
            for method in route.methods - {"GET", "HEAD", "OPTIONS"}:
                yield method, route


def is_protected(route):
    return any(
        hasattr(dependency.call, "protection_policy") for dependency in route.dependant.dependencies
    )


def test_every_state_changing_route_is_protected_or_explicitly_exempt():
    seen = {(method, route.path) for method, route in mutating_routes()}
    assert seen == PROTECTED | EXEMPT, "Classify new write routes as protected or exempt"
    for method, route in mutating_routes():
        assert is_protected(route) == ((method, route.path) in PROTECTED), route.path


def test_real_preview_route_is_rate_limited_before_any_database_work():
    app = create_app(Settings(_env_file=None, environment="test"))
    app.state.arcjet_clients = {ESTIMATE_PREVIEW.name: FakeClient(denied=True)}
    # Skip the lifespan, which would replace the fake with the disabled state.
    response = TestClient(app).post("/estimates/preview", json={})
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
