"""Explicit allowlist of fields exposed by the current-user endpoint."""

from typing import Literal

from pydantic import BaseModel

from app.core.value_types import EntityId, Timestamp


class CompanyMembershipSummary(BaseModel):
    """One active company the user belongs to. Names the company only; no private details."""

    company_id: EntityId
    company_name: str
    role: Literal["company_admin", "sales", "technician"]


class CurrentUserResponse(BaseModel):
    id: EntityId
    role: Literal["customer", "platform_admin"]
    created_at: Timestamp
    # Active memberships only. Lets the client choose navigation and build company URLs; it
    # grants nothing, because the backend re-checks membership on every company operation.
    memberships: list[CompanyMembershipSummary]
