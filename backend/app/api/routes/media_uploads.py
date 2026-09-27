"""Issue short-lived ImageKit upload auth after checking target-record access."""

from typing import Annotated
from urllib.parse import unquote, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.media_uploads import (
    AttachedAsset,
    CompletedUpload,
    UploadPermission,
    UploadRequest,
)
from app.core.imagekit import (
    ImageKitServerAdapter,
    ImageKitSettings,
    issue_upload_auth,
    sign_upload_intent,
    verify_upload_intent,
)
from app.core.media_policy import Visibility, validate_upload_metadata
from app.db.session import get_session
from app.models.media_asset import MediaAsset
from app.models.user import AppUser
from app.services.media_uploads import authorize_upload

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload-requests", response_model=UploadPermission)
def request_upload(
    body: UploadRequest,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
) -> UploadPermission:
    policy = authorize_upload(session, user, body.category, body.parent_id)
    try:
        validate_upload_metadata(
            body.category, size_bytes=body.size_bytes, mime_type=body.mime_type
        )
    except ValueError:
        raise HTTPException(422, "Unsupported upload size or type") from None
    if policy.visibility != Visibility.PUBLIC:
        raise HTTPException(403)
    try:
        settings = ImageKitSettings()
    except ValidationError:
        raise HTTPException(503, "ImageKit is not configured") from None
    auth = issue_upload_auth(settings)
    return UploadPermission(
        category=body.category,
        parent_id=body.parent_id,
        visibility=policy.visibility,
        max_bytes=policy.max_bytes,
        allowed_mime_types=sorted(policy.mime_types),
        **auth,
        upload_folder=f"/pending/{auth['token']}",
        attachment_proof=sign_upload_intent(
            settings,
            token=str(auth["token"]),
            expire=int(auth["expire"]),
            owner_id=user.id,
            category=body.category.value,
            parent_id=body.parent_id,
        ),
    )


@router.post("/attachments", response_model=AttachedAsset, status_code=201)
def attach_completed_upload(
    body: CompletedUpload,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
) -> AttachedAsset:
    policy = authorize_upload(session, user, body.category, body.parent_id)
    if policy.visibility != Visibility.PUBLIC:
        raise HTTPException(403)
    try:
        settings = ImageKitSettings()
    except ValidationError:
        raise HTTPException(503, "ImageKit is not configured") from None
    if not verify_upload_intent(
        settings,
        token=body.token,
        expire=body.expire,
        signature=body.attachment_proof,
        owner_id=user.id,
        category=body.category.value,
        parent_id=body.parent_id,
    ):
        raise HTTPException(403)
    adapter = ImageKitServerAdapter(settings)
    try:
        details = adapter.get_file_details(body.file_id)
    except ValueError:
        raise HTTPException(422, "Invalid uploaded file") from None
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(422, "Invalid uploaded file") from None
        raise HTTPException(502, "ImageKit verification failed") from None
    except httpx.HTTPError, ValidationError:
        raise HTTPException(502, "ImageKit verification failed") from None
    finally:
        adapter.close()
    expected_folder = f"/pending/{body.token}/"
    expected_url = f"{str(settings.url_endpoint).rstrip('/')}{details.file_path}"
    delivered_url = str(details.url)
    if (
        details.file_id != body.file_id
        or not details.file_path.startswith(expected_folder)
        or ".." in details.file_path.split("/")
        or unquote(urlsplit(delivered_url).path) != unquote(urlsplit(expected_url).path)
        or urlsplit(delivered_url).scheme != urlsplit(expected_url).scheme
        or urlsplit(delivered_url).netloc != urlsplit(expected_url).netloc
        or details.is_private_file
        or not details.is_published
        or details.mime not in policy.mime_types
        or type(details.size) is not int
        or not 0 < details.size <= policy.max_bytes
        or details.file_type != ("non-image" if details.mime == "application/pdf" else "image")
    ):
        raise HTTPException(422, "Invalid uploaded file")
    if (
        session.scalar(
            select(MediaAsset.id).where(
                MediaAsset.provider == "imagekit", MediaAsset.provider_file_id == body.file_id
            )
        )
        is not None
    ):
        raise HTTPException(409, "Uploaded file is already attached")
    asset = MediaAsset(
        provider="imagekit",
        provider_file_id=body.file_id,
        owner_user_id=user.id,
        category=body.category.value,
        parent_kind=policy.parent_kind.value,
        parent_id=body.parent_id,
        visibility=policy.visibility.value,
        public_url=delivered_url,
    )
    session.add(asset)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Uploaded file is already attached") from None
    return AttachedAsset(
        id=asset.id, category=body.category, parent_id=body.parent_id, visibility=policy.visibility
    )
