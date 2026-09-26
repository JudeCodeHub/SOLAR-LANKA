"""Explicit allowlist of fields exposed by the current-user endpoint."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.value_types import EntityId, Timestamp


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    role: Literal["customer", "platform_admin"]
    created_at: Timestamp
