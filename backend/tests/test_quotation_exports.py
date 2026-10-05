"""Export jobs are replay-safe, make one private document, and only the requester reads it."""

from datetime import UTC, datetime, timedelta
from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfReader
from sqlalchemy import func, select

from app.api.routes.installations import _evidence_storage
from app.core.auth import VerifiedIdentity, require_identity
from app.core.media_policy import AssetCategory
from app.core.private_storage import LocalPrivateStorage
from app.models.outbox_event import OutboxEvent
from app.models.quotation import QuotationRevision
from app.models.quotation_export import QuotationExport
from app.models.user import AppUser
from app.seed_demo import DEMO_CUSTOMER, demo_id, seed_demo
from app.services.workflow_notifications import process_workflow_event

pytestmark = pytest.mark.database

CUSTOMER = DEMO_CUSTOMER[1]
CUSTOMER_ID = DEMO_CUSTOMER[0]


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


def make_export(session, status="pending", **values):
    export = QuotationExport(
        revision_id=demo_id("revised", "revision", "2"),
        requester_id=CUSTOMER_ID,
        status=status,
        **values,
    )
    session.add(export)
    session.commit()
    return export


def test_a_failed_commit_leaves_no_file_and_a_retry_makes_exactly_one(database_session, tmp_path):
    from app.services.quotation_export import build_export

    session = database_session
    seed_demo(session, environment="test")
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    export = make_export(session)

    real_commit = session.commit

    def failing_commit():
        raise RuntimeError("database went away")

    session.commit = failing_commit
    with pytest.raises(RuntimeError):
        build_export(session, export.id, storage)
    session.commit = real_commit
    assert list((tmp_path / "private").iterdir()) == []
    assert session.get(type(export), export.id).file_id is None

    assert build_export(session, export.id, storage) is True
    assert [p.name for p in (tmp_path / "private").iterdir()] == [export.id.hex]
    assert build_export(session, export.id, storage) is False


def test_a_file_left_by_a_crashed_attempt_is_replaced_not_duplicated(database_session, tmp_path):
    from app.services.quotation_export import build_export

    session = database_session
    seed_demo(session, environment="test")
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    export = make_export(session)
    storage.save(
        category=AssetCategory.QUOTATION_DOCUMENT,
        content=b"%PDF-1.4 half written",
        mime_type="application/pdf",
        file_id=export.id.hex,
    )
    assert build_export(session, export.id, storage) is True
    files = list((tmp_path / "private").iterdir())
    assert [p.name for p in files] == [export.id.hex]
    assert b"half written" not in files[0].read_bytes()


def test_cleanup_removes_old_exports_and_stray_files_only(database_session, tmp_path):
    from sqlalchemy import update

    from app.services.quotation_export import build_export, cleanup_exports

    session = database_session
    seed_demo(session, environment="test")
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    other = storage.save(
        category=AssetCategory.QUOTATION_DOCUMENT,
        content=b"%PDF-1.4 someone else's file",
        mime_type="application/pdf",
    )
    old = make_export(session)
    build_export(session, old.id, storage)
    session.execute(
        update(QuotationExport)
        .where(QuotationExport.id == old.id)
        .values(ready_at=datetime.now(UTC) - timedelta(days=40))
    )
    session.commit()

    # A second person's recent export and a crashed pending one are told apart.
    stranger = AppUser(clerk_subject="export_cleanup_other")
    session.add(stranger)
    session.flush()
    crashed = QuotationExport(
        revision_id=old.revision_id,
        requester_id=stranger.id,
        created_at=datetime.now(UTC) - timedelta(days=3),
    )
    session.add(crashed)
    session.commit()
    storage.save(
        category=AssetCategory.QUOTATION_DOCUMENT,
        content=b"%PDF-1.4 stray",
        mime_type="application/pdf",
        file_id=crashed.id.hex,
    )

    assert cleanup_exports(session, storage) == {"expired": 1, "stray": 1}
    assert session.get(QuotationExport, old.id) is None
    assert session.get(QuotationExport, crashed.id) is not None
    assert [p.name for p in (tmp_path / "private").iterdir()] == [other]
    assert cleanup_exports(session, storage) == {"expired": 0, "stray": 0}
