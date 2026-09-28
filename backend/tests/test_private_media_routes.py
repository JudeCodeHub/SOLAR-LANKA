"""Private files require current parent permissions and use generated disk paths."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import require_local_user
from app.api.routes.private_media import get_private_storage
from app.core.config import Settings
from app.core.media_policy import AssetCategory, policy_for
from app.core.private_storage import LocalPrivateStorage
from app.db.session import get_session
from app.main import create_app
from app.models.company import Company, CompanyMembership
from app.models.media_asset import MediaAsset
from app.models.user import AppUser


class FakeSession:
    def __init__(self, user: AppUser, company: Company) -> None:
        self.company = company
        self.membership = CompanyMembership(
            user_id=user.id, company_id=company.id, role="company_admin", status="active"
        )
        self.asset = None

    def get(self, model, record_id):
        if model is Company and self.company is not None and record_id == self.company.id:
            return self.company
        return None

    def scalars(self, statement):
        model = statement.column_descriptions[0]["entity"]
        params = set(statement.compile().params.values())
        if model is MediaAsset:
            asset = self.asset if self.asset is not None and self.asset.id in params else None
            return SimpleNamespace(one_or_none=lambda: asset)
        if model is CompanyMembership:
            member = self.membership
            if member is not None and not {member.user_id, member.company_id, "active"} <= params:
                member = None
            return SimpleNamespace(one_or_none=lambda: member)
        raise AssertionError("Unexpected model")

    def add(self, asset):
        self.asset = asset

    def commit(self):
        if self.asset is not None and self.asset.id is None:
            self.asset.id = uuid4()

    def rollback(self):
        pass


def test_private_download_and_replacement_recheck_company_access(tmp_path) -> None:
    user = AppUser(
        id=uuid4(),
        clerk_subject="verified",
        role="customer",
        is_suspended=False,
        provider_state="active",
    )
    company = Company(id=uuid4(), name="Test installer")
    session = FakeSession(user, company)
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    app = create_app(Settings(_env_file=None, environment="test"))
    app.dependency_overrides[require_local_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_private_storage] = lambda: storage
    client = TestClient(app)

    created = client.post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("../../secret.pdf", b"%PDF-first", "application/pdf")},
    )
    assert created.status_code == 201
    asset_id = created.json()["id"]
    old_file_id = session.asset.provider_file_id
    assert len(old_file_id) == 32
    assert sorted(path.name for path in storage.root.iterdir()) == [old_file_id]

    downloaded = client.get(f"/media/private-attachments/{asset_id}")
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-first"
    assert downloaded.headers["cache-control"] == "no-store"
    assert downloaded.headers["content-disposition"] == 'attachment; filename="credential.pdf"'

    session.membership = None
    assert client.get(f"/media/private-attachments/{asset_id}").status_code == 404
    denied = client.put(
        f"/media/private-attachments/{asset_id}",
        files={"file": ("replacement.pdf", b"%PDF-denied", "application/pdf")},
    )
    assert denied.status_code == 404
    assert storage.read(old_file_id) == b"%PDF-first"

    session.membership = CompanyMembership(
        user_id=user.id, company_id=company.id, role="company_admin", status="active"
    )
    session.company = None
    assert client.get(f"/media/private-attachments/{asset_id}").status_code == 404
    session.company = company

    replaced = client.put(
        f"/media/private-attachments/{asset_id}",
        files={"file": ("../../changed.pdf", b"%PDF-second", "application/pdf")},
    )
    assert replaced.status_code == 200
    assert replaced.json()["id"] == asset_id
    assert session.asset.provider_file_id != old_file_id
    assert not (storage.root / old_file_id).exists()
    assert client.get(f"/media/private-attachments/{asset_id}").content == b"%PDF-second"


def test_non_admin_cannot_upload_private_company_document(tmp_path) -> None:
    user = AppUser(
        id=uuid4(),
        clerk_subject="verified-sales",
        role="customer",
        is_suspended=False,
        provider_state="active",
    )
    company = Company(id=uuid4(), name="Test installer")
    session = FakeSession(user, company)
    session.membership.role = "sales"
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    app = create_app(Settings(_env_file=None, environment="test"))
    app.dependency_overrides[require_local_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_private_storage] = lambda: storage

    response = TestClient(app).post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("proof.pdf", b"%PDF-proof", "application/pdf")},
    )
    assert response.status_code == 403
    assert list(storage.root.iterdir()) == []


@pytest.fixture
def private_media_client(tmp_path):
    user = AppUser(
        id=uuid4(),
        clerk_subject="owner",
        role="customer",
        is_suspended=False,
        provider_state="active",
    )
    company = Company(id=uuid4(), name="Owner company")
    session = FakeSession(user, company)
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    app = create_app(Settings(_env_file=None, environment="test"))
    app.dependency_overrides[require_local_user] = lambda: user
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[get_private_storage] = lambda: storage
    return TestClient(app), app, user, company, session, storage


@pytest.mark.parametrize(
    ("content", "mime_type"),
    [
        (b"%PDF-fake", "image/png"),
        (b"not a PDF", "application/pdf"),
        (b"%PDF-fake", "application/octet-stream"),
    ],
)
def test_unsupported_private_uploads_fail(private_media_client, content, mime_type) -> None:
    client, _, _, company, session, storage = private_media_client
    result = client.post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("anything.pdf", content, mime_type)},
    )
    assert result.status_code == 422
    assert session.asset is None
    assert list(storage.root.iterdir()) == []


def test_oversized_upload_and_invalid_replacement_leave_old_file(private_media_client) -> None:
    client, _, _, company, session, storage = private_media_client
    created = client.post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("proof.pdf", b"%PDF-original", "application/pdf")},
    )
    assert created.status_code == 201
    asset_id = created.json()["id"]
    old_file_id = session.asset.provider_file_id
    too_large = b"%PDF-" + b"x" * policy_for(AssetCategory.COMPANY_CREDENTIAL_DOCUMENT).max_bytes
    oversized = client.post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("huge.pdf", too_large, "application/pdf")},
    )
    assert oversized.status_code == 422
    invalid_replacement = client.put(
        f"/media/private-attachments/{asset_id}",
        files={"file": ("changed.pdf", b"not a PDF", "application/pdf")},
    )
    assert invalid_replacement.status_code == 422
    assert session.asset.provider_file_id == old_file_id
    assert sorted(path.name for path in storage.root.iterdir()) == [old_file_id]
    assert storage.read(old_file_id) == b"%PDF-original"


def test_foreign_company_and_guessed_ids_reveal_no_private_content(private_media_client) -> None:
    client, app, _, company, session, storage = private_media_client
    secret = b"%PDF-private-customer-record"
    created = client.post(
        f"/media/companies/{company.id}/credential-documents",
        files={"file": ("secret.pdf", secret, "application/pdf")},
    )
    assert created.status_code == 201
    asset_id = created.json()["id"]
    old_file_id = session.asset.provider_file_id

    foreign_user = AppUser(
        id=uuid4(),
        clerk_subject="foreign",
        role="customer",
        is_suspended=False,
        provider_state="active",
    )
    foreign_company = Company(id=uuid4(), name="Foreign company")
    session.company = foreign_company
    session.membership = CompanyMembership(
        user_id=foreign_user.id,
        company_id=foreign_company.id,
        role="company_admin",
        status="active",
    )
    app.dependency_overrides[require_local_user] = lambda: foreign_user

    foreign = client.get(f"/media/private-attachments/{asset_id}")
    guessed = client.get(f"/media/private-attachments/{uuid4()}")
    assert foreign.status_code == guessed.status_code == 404
    assert foreign.json() == guessed.json()
    assert secret not in foreign.content + guessed.content
    denied_replace = client.put(
        f"/media/private-attachments/{asset_id}",
        files={"file": ("replace.pdf", b"%PDF-foreign", "application/pdf")},
    )
    assert denied_replace.status_code == 404
    assert session.asset.provider_file_id == old_file_id
    assert sorted(path.name for path in storage.root.iterdir()) == [old_file_id]
