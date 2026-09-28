"""Only the owner may list or inspect saved estimate snapshots."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.estimator_config import EstimatorConfigVersion
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from tests.test_estimate_preview import request_body
from tests.test_estimator_finance import financial_config

pytestmark = pytest.mark.database


def test_owner_only_list_and_detail(database_client, database_connection, database_session):
    schema = f"estimate_access_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, EstimatorConfigVersion, SavedEstimate):
        model.__table__.create(database_connection)
    owner = AppUser(clerk_subject="user_estimate_owner")
    other = AppUser(clerk_subject="user_estimate_other")
    config = financial_config()
    config.published_at = datetime.now(UTC)
    database_session.add_all([owner, other, config])
    database_session.commit()

    current_subject = {"value": owner.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        current_subject["value"], "session_test"
    )
    base = "/users/me/estimates"
    created = database_client.post(base, json=request_body())
    assert created.status_code == 201
    saved_id = created.json()["id"]
    owner_list = database_client.get(base)
    assert owner_list.status_code == 200
    assert owner_list.headers["cache-control"] == "no-store"
    assert owner_list.json()["total"] == 1
    assert owner_list.json()["items"][0]["id"] == saved_id
    assert owner_list.json()["items"][0]["panel_count_minimum"] == 5
    assert database_client.get(base, params={"limit": 1, "offset": 1}).json()["items"] == []
    detail = database_client.get(f"{base}/{saved_id}")
    assert detail.status_code == 200
    assert detail.headers["cache-control"] == "no-store"
    assert detail.json()["estimate"] == created.json()["estimate"]
    assert detail.json()["inputs"]["monthly_consumption_kwh"] == "300"
    assert detail.json()["configuration"]["assumptions"] == config.assumptions
    assert "source_metadata" not in detail.json()["configuration"]
    assert detail.json()["configuration"]["sources"]["cost"]["url"] is None

    current_subject["value"] = other.clerk_subject
    other_list = database_client.get(base)
    assert other_list.status_code == 200
    assert other_list.json()["total"] == 0
    assert other_list.json()["items"] == []
    assert database_client.get(f"{base}/{saved_id}").status_code == 404
    assert database_client.get(f"{base}/{uuid4()}").status_code == 404

    current_subject["value"] = owner.clerk_subject
    assert database_client.get(f"{base}/{saved_id}").status_code == 200
