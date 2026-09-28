"""Local-development private credential documents with per-request company access."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.core.media_policy import AssetCategory, Visibility, policy_for
from app.core.private_storage import LocalPrivateStorage
from app.db.session import get_session
from app.models.media_asset import MediaAsset
from app.models.user import AppUser
from app.services.media_uploads import authorize_upload

router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)
CATEGORY = AssetCategory.COMPANY_CREDENTIAL_DOCUMENT


def get_private_storage(request: Request) -> LocalPrivateStorage:
    try:
        return LocalPrivateStorage(environment=request.app.state.settings.environment)
    except RuntimeError:
        raise HTTPException(503, "Private storage is not configured") from None


def _company_policy(session: Session, user: AppUser, company_id: UUID):
    return authorize_upload(session, user, CATEGORY, company_id)


def _private_asset(session: Session, user: AppUser, asset_id: UUID, *, lock: bool) -> MediaAsset:
    query = select(MediaAsset).where(MediaAsset.id == asset_id)
    if lock:
        query = query.with_for_update()
    asset = session.scalars(query).one_or_none()
    if (
        asset is None
        or asset.category != CATEGORY
        or asset.parent_kind != "company"
        or asset.visibility != Visibility.PRIVATE
        or asset.provider != "local_private"
        or asset.public_url is not None
    ):
        raise HTTPException(404)
    try:
        _company_policy(session, user, asset.parent_id)
    except HTTPException:
        raise HTTPException(404) from None
    return asset


def _save_file(storage: LocalPrivateStorage, file: UploadFile) -> str:
    max_bytes = policy_for(CATEGORY).max_bytes
    content = file.file.read(max_bytes + 1)
    try:
        return storage.save(category=CATEGORY, content=content, mime_type=file.content_type or "")
    except ValueError:
        raise HTTPException(422, "Unsupported private file") from None


@router.post("/companies/{company_id}/credential-documents", status_code=201)
def upload_company_credential_document(
    company_id: UUID,
    file: Annotated[UploadFile, File()],
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(get_private_storage)],
) -> dict[str, str]:
    policy = _company_policy(session, user, company_id)
    file_id = _save_file(storage, file)
    asset = MediaAsset(
        provider="local_private",
        provider_file_id=file_id,
        owner_user_id=user.id,
        category=CATEGORY.value,
        parent_kind=policy.parent_kind.value,
        parent_id=company_id,
        visibility=Visibility.PRIVATE.value,
    )
    session.add(asset)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete(file_id)
        raise
    return {"id": str(asset.id)}


@router.get("/private-attachments/{asset_id}")
def download_private_attachment(
    asset_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(get_private_storage)],
) -> Response:
    asset = _private_asset(session, user, asset_id, lock=True)
    try:
        content = storage.read(asset.provider_file_id)
    except FileNotFoundError, ValueError:
        raise HTTPException(404) from None
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'attachment; filename="credential.pdf"',
        },
    )


@router.put("/private-attachments/{asset_id}")
def replace_private_attachment(
    asset_id: UUID,
    file: Annotated[UploadFile, File()],
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(get_private_storage)],
) -> dict[str, str]:
    asset = _private_asset(session, user, asset_id, lock=True)
    new_file_id = _save_file(storage, file)
    old_file_id = asset.provider_file_id
    asset.provider_file_id = new_file_id
    asset.owner_user_id = user.id
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete(new_file_id)
        raise
    try:
        storage.delete(old_file_id)
    except OSError:
        logger.warning("Obsolete private file could not be removed")
    return {"id": str(asset.id)}
