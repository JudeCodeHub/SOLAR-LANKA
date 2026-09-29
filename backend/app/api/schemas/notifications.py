"""Recipient-scoped notification responses."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.api.schemas.pagination import PaginationParams


class NotificationView(BaseModel):
    id: UUID
    kind: str
    title: str
    body: str
    target_kind: str | None
    target_id: UUID | None
    read_at: datetime | None
    created_at: datetime


class NotificationQuery(PaginationParams):
    unread_only: bool = False
