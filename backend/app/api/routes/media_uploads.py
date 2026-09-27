"""Authenticated upload preflight; provider authorization follows in 6.05."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.media_uploads import UploadPermission, UploadRequest
from app.core.media_policy import validate_upload_metadata
from app.db.session import get_session
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
    return UploadPermission(
        category=body.category,
        parent_id=body.parent_id,
        visibility=policy.visibility,
        max_bytes=policy.max_bytes,
        allowed_mime_types=sorted(policy.mime_types),
    )
