"""Visitors can preview only the latest published estimate without saving it."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.models.estimator_config import EstimatorConfigVersion
from tests.test_estimator_finance import financial_config

pytestmark = pytest.mark.database


def request_body():
    return {
        "monthly_consumption_kwh": "300",
        "district": "Colombo",
        "usable_roof_area_m2": "30",
        "shading_condition": "partial",
        "daytime_consumption_percent": "50",
        "connection_scheme": "net_metering",
        "system_type": "on_grid",
        "backup_required": False,
    }


def test_public_preview_uses_published_version_without_storing_inputs(
    database_client, database_connection, database_session
):
    schema = f"estimate_preview_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    EstimatorConfigVersion.__table__.create(database_connection)
    route = "/estimates/preview"
    assert database_client.post(route, json=request_body()).status_code == 503

    draft = financial_config()
    draft.status = "draft"
    draft.version = 2
    database_session.add(draft)
    database_session.commit()
    assert database_client.post(route, json=request_body()).status_code == 503

    published = financial_config()
    published.published_at = datetime.now(UTC)
    published.source_metadata["yield"].update(
        {
            "publisher": "Fictional test source",
            "title": "Fictional yield",
            "unit": "kWh/kWp/year",
            "reviewed_on": "2026-09-28",
        }
    )
    database_session.add(published)
    database_session.commit()
    result = database_client.post(route, json=request_body())
    assert result.status_code == 200
    body = result.json()
    assert result.headers["cache-control"] == "no-store"
    assert body["config_version"] == 1
    assert body["sizing"]["panel_count"] == {"minimum": 5, "maximum": 5}
    assert body["financial"]["installed_cost_lkr"] == {"minimum": "250000.0", "maximum": "300000.0"}
    assert body["sources"]["yield"]["publisher"] == "Fictional test source"
    assert body["sources"]["cost"]["url"] is None
    assert "assumptions" not in body
    unsupported = database_client.post(route, json={**request_body(), "backup_required": True})
    assert unsupported.status_code == 422

    newer = financial_config()
    newer.version = 3
    newer.published_at = datetime.now(UTC)
    newer.assumptions["panel_wattage_w"] = "400"
    database_session.add(newer)
    database_session.commit()
    latest = database_client.post(route, json=request_body()).json()
    assert latest["config_version"] == 3
    assert latest["sizing"]["panel_count"] != body["sizing"]["panel_count"]
    assert database_session.scalar(select(func.count()).select_from(EstimatorConfigVersion)) == 3
