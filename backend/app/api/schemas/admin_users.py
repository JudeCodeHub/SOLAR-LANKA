"""Platform-only application account status contract."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AccountStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_suspended: bool


class AccountStatusView(BaseModel):
    id: UUID
    is_suspended: bool
    provider_state: str
