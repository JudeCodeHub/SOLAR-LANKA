"""Publishing new assumptions never changes an earlier customer's saved result."""

from copy import deepcopy
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


def complete_sources(config: EstimatorConfigVersion) -> None:
    for topic, unit in (
        ("yield", "kWh/kWp/year"),
        ("tariff", "LKR/kWh"),
        ("cost", "LKR/kWp"),
    ):
        config.source_metadata[topic].update({
            "publisher": "Fictional test publisher",
            "title": f"Fictional {topic} reference",
            "unit": unit,
            "reviewed_on": "2026-09-28",
            "effective_from": "2026-09-28",
            "limitation": "Test scenario only, not a real market estimate",
        })


def test_saved_snapshot_survives_new_publication(
    database_client, database_connection, database_session
):
    schema = f"estimate_history_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, EstimatorConfigVersion, SavedEstimate):
        model.__table__.create(database_connection)
    customer = AppUser(clerk_subject="user_history_customer")
    admin = AppUser(clerk_subject="user_history_admin", role="platform_admin")
    first_config = financial_config()
    complete_sources(first_config)
    first_config.published_at = datetime.now(UTC)
    database_session.add_all([customer, admin, first_config])
    database_session.commit()

    current_subject = {"value": customer.clerk_subject}
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        current_subject["value"], "session_test"
    )
    path = "/users/me/estimates"
    saved_response = database_client.post(path, json=request_body())
    assert saved_response.status_code == 201
    saved_id = saved_response.json()["id"]
    before = database_client.get(f"{path}/{saved_id}").json()
    raw_before = deepcopy(database_session.get(SavedEstimate, saved_id).configuration_snapshot)
    assert before["configuration"]["version"] == 1
    assert before["estimate"]["config_version"] == 1

    current_subject["value"] = admin.clerk_subject
    next_assumptions = deepcopy(first_config.assumptions)
    next_assumptions["annual_yield_kwh_per_kwp"] = {"low": "1000", "high": "1000"}
    draft = database_client.post(
        "/admin/estimator-configs/drafts",
        json={
            "assumptions": next_assumptions,
            "source_metadata": first_config.source_metadata,
        },
    )
    assert draft.status_code == 201
    assert draft.json()["version"] == 2
    # Drafts do not replace the active calculation.
    preview_before = database_client.post("/estimates/preview", json=request_body()).json()
    assert preview_before["config_version"] == 1
    published = database_client.post(
        f"/admin/estimator-configs/drafts/{draft.json()['id']}/publish"
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"

    preview_after = database_client.post("/estimates/preview", json=request_body()).json()
    assert preview_after["config_version"] == 2
    assert preview_after["sizing"]["panel_count"] != before["estimate"]["sizing"]["panel_count"]
    current_subject["value"] = customer.clerk_subject
    assert database_client.get(f"{path}/{saved_id}").json() == before
    assert database_session.get(SavedEstimate, saved_id).configuration_snapshot == raw_before
    newer_save = database_client.post(path, json=request_body())
    assert newer_save.status_code == 201
    assert newer_save.json()["estimate"]["config_version"] == 2
    assert database_client.get(f"{path}/{saved_id}").json() == before
