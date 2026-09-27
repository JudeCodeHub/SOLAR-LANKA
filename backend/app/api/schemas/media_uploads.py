"""Upload preflight input and safe policy output."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.core.media_policy import AssetCategory, Visibility


class UploadRequest(BaseModel):
    category: AssetCategory
    parent_id: UUID
    size_bytes: int = Field(gt=0)
    mime_type: str


class UploadPermission(BaseModel):
    category: AssetCategory
    parent_id: UUID
    visibility: Visibility
    max_bytes: int
    allowed_mime_types: list[str]
    token: str
    expire: int
    signature: str
    publicKey: str
    upload_folder: str
    attachment_proof: str


class CompletedUpload(BaseModel):
    category: AssetCategory
    parent_id: UUID
    file_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,255}$")
    token: UUID
    expire: int
    attachment_proof: str


class AttachedAsset(BaseModel):
    id: UUID
    category: AssetCategory
    parent_id: UUID
    visibility: Visibility
