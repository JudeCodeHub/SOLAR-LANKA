"""Admin draft and publication workflow preserves estimator versions."""

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.estimator_config import EstimatorConfigVersion
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from app.services.estimates import latest_published_config

pytestmark = pytest.mark.database


def test_admin_draft_publish_and_immutable_api(
    database_client, database_connection, database_session
) -> None:
    schema = f"estimator_admin_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    AppUser.__table__.create(database_connection)
    EstimatorConfigVersion.__table__.create(database_connection)
    SavedEstimate.__table__.create(database_connection)
    user = AppUser(clerk_subject="user_estimator_admin")
    database_session.add(user)
    database_session.commit()
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        "user_estimator_admin", "session_test"
    )
    source = {
        "publisher": "Test source",
        "title": "Fictional example",
        "url": "https://example.org/source",
        "unit": "kWh/kWp/year",
        "reviewed_on": "2026-09-28",
        "effective_from": None,
        "limitation": "Fictional test data only",
    }
    body = {
        "assumptions": {"yield_kwh_per_kwp_year": None},
        "source_metadata": {"yield": source, "tariff": source, "cost": source},
    }
    base = "/admin/estimator-configs"
    assert database_client.post(f"{base}/drafts", json=body).status_code == 403
    assert database_client.get(base).status_code == 403
    user.role = "platform_admin"
    database_session.commit()
    created = database_client.post(f"{base}/drafts", json=body)
    assert created.status_code == 201
    version_id = created.json()["id"]
    assert created.json()["version"] == 1
    listed = database_client.get(base)
    assert [(v["version"], v["status"]) for v in listed.json()] == [(1, "draft")]
    detail = database_client.get(f"{base}/{version_id}")
    assert (
        detail.status_code == 200
        and detail.json()["source_metadata"]["yield"]["publisher"] == "Test source"
    )
    assert database_client.get(f"{base}/{uuid4()}").status_code == 404
    changed = {**body, "assumptions": {"yield_kwh_per_kwp_year": 1500}}
    assert database_client.put(f"{base}/drafts/{version_id}", json=changed).status_code == 200
    published = database_client.post(f"{base}/drafts/{version_id}/publish")
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert database_client.put(f"{base}/drafts/{version_id}", json=body).status_code == 409
    assert database_client.post(f"{base}/drafts/{version_id}/publish").status_code == 409
    database_session.expire_all()
    stored = database_session.get(EstimatorConfigVersion, version_id)
    assert stored.assumptions == changed["assumptions"]
    assert stored.source_metadata["yield"]["publisher"] == "Test source"
    assert stored.published_at is not None
    second = database_client.post(f"{base}/drafts", json=body)
    assert second.status_code == 201
    assert second.json()["version"] == 2
    assert database_client.post(f"{base}/{version_id}/archive").status_code == 409
    snapshot = {
        "assumptions": changed["assumptions"],
        "source_metadata": stored.source_metadata,
        "scenario": stored.scenario,
        "version": stored.version,
        "published_at": stored.published_at.isoformat(),
    }
    estimate = SavedEstimate(
        user_id=user.id,
        config_version_id=stored.id,
        input_snapshot={"monthly_bill_lkr": 1000},
        configuration_snapshot=snapshot,
        result_snapshot={"sizing": {}, "financial": {}, "sources": {}},
    )
    database_session.add(estimate)
    database_session.commit()
    second_id = second.json()["id"]
    assert database_client.post(f"{base}/drafts/{second_id}/publish").status_code == 200
    archived = database_client.post(f"{base}/{version_id}/archive")
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True
    assert database_client.post(f"{base}/{version_id}/archive").status_code == 409
    assert database_client.post(f"{base}/{second_id}/archive").status_code == 409
    database_session.expire_all()
    assert database_session.get(SavedEstimate, estimate.id).configuration_snapshot == snapshot
    assert database_session.get(EstimatorConfigVersion, version_id).is_archived
    assert str(latest_published_config(database_session).id) == second_id
