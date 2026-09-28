"""Saved estimates retain the exact input, configuration, source, and output data."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.estimator_config import EstimatorConfigVersion
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from tests.test_estimate_preview import request_body
from tests.test_estimator_finance import financial_config

pytestmark = pytest.mark.database


def test_customer_save_retains_complete_historical_snapshots(
    database_client, database_connection, database_session
):
    schema = f"saved_estimate_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, EstimatorConfigVersion, SavedEstimate):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_estimate_customer")
    config = financial_config()
    config.published_at = datetime.now(UTC)
    database_session.add_all([customer, config])
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_estimate_customer", "session_test"
    )
    body = {**request_body(), "monthly_bill_lkr": "0"}
    response = database_client.post("/users/me/estimates", json=body)
    assert response.status_code == 201
    result = response.json()
    assert result["estimate"]["config_version"] == 1
    assert response.headers["cache-control"] == "no-store"
    saved = database_session.get(SavedEstimate, result["id"])
    assert saved.user_id == customer.id
    assert saved.config_version_id == config.id
    assert saved.created_at.utcoffset() is not None
    assert saved.input_snapshot["monthly_bill_lkr"] == "0.00"
    assert saved.input_snapshot["backup_required"] is False
    assert saved.configuration_snapshot["assumptions"] == config.assumptions
    assert saved.configuration_snapshot["source_metadata"] == config.source_metadata
    assert saved.configuration_snapshot["version"] == 1
    assert saved.configuration_snapshot["published_at"]
    assert saved.result_snapshot == result["estimate"]
    assert database_session.scalar(select(func.count()).select_from(SavedEstimate)) == 1


def test_platform_admin_cannot_save_a_customer_estimate(
    database_client, database_connection, database_session
):
    schema = f"saved_estimate_admin_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, EstimatorConfigVersion, SavedEstimate):
        model.__table__.create(database_connection)
    admin = AppUser(clerk_subject="user_estimate_admin", role="platform_admin")
    database_session.add(admin)
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_estimate_admin", "session_test"
    )
    assert database_client.post("/users/me/estimates", json=request_body()).status_code == 403
    assert database_session.scalar(select(func.count()).select_from(SavedEstimate)) == 0
