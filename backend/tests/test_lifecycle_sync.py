"""Signed webhook integration tests against transaction-isolated PostgreSQL."""

import base64
import json
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select, text
from svix.webhooks import Webhook

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.lifecycle_event import LifecycleEvent
from app.models.user import AppUser

SECRET = "whsec_" + base64.b64encode(b"test-secret-for-webhook-signing-32").decode()
pytestmark = pytest.mark.database


@pytest.fixture
def webhook_client(database_client, database_connection):
    schema = f"lifecycle_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, CompanyMembership, LifecycleEvent):
        model.__table__.create(database_connection)
    settings = database_client.app.state.settings
    database_client.app.state.settings = settings.model_copy(
        update={"clerk_webhook_signing_secret": SecretStr(SECRET), "clerk_instance_id": "ins_test"}
    )
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_test", "sess_test"
    )
    return database_client


def send(
    client,
    *,
    kind="user.updated",
    timestamp=1000,
    banned=False,
    event_id=None,
    corrupt=False,
    stale=False,
    instance="ins_test",
    **data,
):
    body = json.dumps(
        {
            "object": "event",
            "type": kind,
            "timestamp": timestamp,
            "instance_id": instance,
            "data": {"id": "user_test", "banned": banned, "locked": False, **data},
        }
    )
    event_id = event_id or f"msg_{uuid4().hex}"
    now = datetime.now(UTC) - timedelta(minutes=10 if stale else 0)
    signature = Webhook(SECRET).sign(event_id, now, body)
    return client.post(
        "/webhooks/clerk",
        content=body + (" " if corrupt else ""),
        headers={
            "svix-id": event_id,
            "svix-timestamp": str(int(now.timestamp())),
            "svix-signature": signature,
            "content-type": "application/json",
        },
    )


def test_replay_cannot_duplicate_or_elevate(webhook_client, database_session):
    for _ in range(2):
        assert send(webhook_client, event_id="msg_same", role="platform_admin").status_code == 204
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 1
    assert database_session.scalar(select(func.count()).select_from(LifecycleEvent)) == 1
    user = database_session.scalars(select(AppUser)).one()
    assert user.role == "customer"


@pytest.mark.parametrize(
    "options",
    [
        {"corrupt": True},
        {"stale": True},
        {"instance": "ins_wrong"},
        {"banned": None},
    ],
)
def test_invalid_events_do_not_write(webhook_client, database_session, options):
    assert send(webhook_client, **options).status_code == 400
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 0
    assert database_session.scalar(select(func.count()).select_from(LifecycleEvent)) == 0


def test_revocation_order_and_local_suspension(webhook_client, database_session):
    assert send(webhook_client, banned=True, timestamp=2000).status_code == 204
    assert webhook_client.get("/users/me").status_code == 403
    for timestamp in (1000, 2000):
        assert send(webhook_client, timestamp=timestamp).status_code == 204
        assert webhook_client.get("/users/me").status_code == 403
    assert send(webhook_client, timestamp=3000).status_code == 204
    assert webhook_client.get("/users/me").status_code == 200
    user = database_session.scalars(select(AppUser)).one()
    user.is_suspended = True
    database_session.commit()
    assert send(webhook_client, timestamp=4000).status_code == 204
    assert webhook_client.get("/users/me").status_code == 403


def test_deletion_before_provisioning_is_permanent(webhook_client, database_session):
    assert send(webhook_client, kind="user.deleted", timestamp=2000).status_code == 204
    assert webhook_client.get("/users/me").status_code == 403
    for timestamp in (1000, 3000):
        assert send(webhook_client, kind="user.created", timestamp=timestamp).status_code == 204
        assert webhook_client.get("/users/me").status_code == 403
    user = database_session.scalars(select(AppUser)).one()
    assert user.provider_state == "deleted"
    assert user.clerk_subject == "user_test"


def test_transaction_failure_can_retry(webhook_client, database_session, monkeypatch):
    from app.api.routes import webhooks

    original = webhooks.synchronize_account

    def fail(*args):
        original(*args)
        raise RuntimeError("simulated transaction failure")

    monkeypatch.setattr(webhooks, "synchronize_account", fail)
    with pytest.raises(RuntimeError):
        send(webhook_client, event_id="msg_retry")
    monkeypatch.setattr(webhooks, "synchronize_account", original)
    assert send(webhook_client, event_id="msg_retry").status_code == 204
    assert database_session.scalar(select(func.count()).select_from(AppUser)) == 1
