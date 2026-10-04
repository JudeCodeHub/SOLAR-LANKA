"""Export jobs are replay-safe, make one private document, and only the requester reads it."""

from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfReader
from sqlalchemy import func, select

from app.api.routes.installations import _evidence_storage
from app.core.auth import VerifiedIdentity, require_identity
from app.core.private_storage import LocalPrivateStorage
from app.models.outbox_event import OutboxEvent
from app.models.quotation import QuotationRevision
from app.models.quotation_export import QuotationExport
from app.models.user import AppUser
from app.seed_demo import DEMO_CUSTOMER, demo_id, seed_demo
from app.services.workflow_notifications import process_workflow_event

pytestmark = pytest.mark.database

CUSTOMER = DEMO_CUSTOMER[1]


def test_export_is_idempotent_private_and_matches_the_revision(
    database_client, database_session, tmp_path
):
    client, session = database_client, database_session
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    client.app.dependency_overrides[_evidence_storage] = lambda: storage
    seed_demo(session, environment="test")
    stranger = AppUser(clerk_subject="export_stranger")
    session.add(stranger)
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    name = next(
        n
        for n in ("accepted", "sent", "pending")
        if session.get(QuotationRevision, demo_id(n, "revision", "1")) is not None
    )
    revision = session.get(QuotationRevision, demo_id(name, "revision", "1"))
    base = (
        f"/users/me/requests/{demo_id(name, 'request')}/quotations/"
        f"{demo_id(name, 'quotation')}/revisions/{revision.id}/export"
    )
    act_as(CUSTOMER)
    first = client.post(base)
    assert first.status_code == 202
    again = client.post(base)
    assert again.json()["id"] == first.json()["id"]
    export_id = first.json()["id"]
    assert session.scalar(select(func.count()).select_from(QuotationExport)) == 1
    key = f"quotation.export_requested:{export_id}"
    assert session.scalar(select(func.count()).where(OutboxEvent.event_key == key)) == 1
    assert client.get(f"/users/me/exports/{export_id}/file").status_code == 409

    # Retries and replays produce one file.
    assert process_workflow_event(session, key, storage) is True
    assert process_workflow_event(session, key, storage) is False
    assert len(list((tmp_path / "private").iterdir())) == 1
    done = client.get(f"/users/me/exports/{export_id}").json()
    assert done["status"] == "ready"
    assert client.post(base).json()["status"] == "ready"
    assert len(list((tmp_path / "private").iterdir())) == 1

    download = client.get(f"/users/me/exports/{export_id}/file")
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert download.headers["cache-control"] == "no-store"
    text = "\n".join(p.extract_text() for p in PdfReader(BytesIO(download.content)).pages)
    assert f"{revision.total:.2f}" in text
    assert f"Revision: {revision.revision_number}" in text

    # No one else can see the status or the file, and unknown exports are not found.
    act_as("export_stranger")
    assert client.get(f"/users/me/exports/{export_id}").status_code == 404
    assert client.get(f"/users/me/exports/{export_id}/file").status_code == 404
    assert client.post(base).status_code == 404
    assert client.get(f"/users/me/exports/{uuid4()}").status_code == 404
