"""Explicit company-role inputs; platform roles cannot be assigned here."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.core.value_types import EntityId, Timestamp

CompanyRole = Literal["company_admin", "sales", "technician"]


class MembershipCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: EntityId
    role: CompanyRole


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    user_id: EntityId
    company_id: EntityId
    role: CompanyRole
    status: Literal["active", "suspended"]


class InviteCreated(BaseModel):
    """The code is shown once, here; afterwards only its last characters are kept."""

    id: EntityId
    code: str
    expires_at: Timestamp


class InviteView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    code_hint: str
    status: Literal["active", "used", "revoked", "expired"]
    expires_at: Timestamp
    created_at: Timestamp


class InviteAccept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=6, max_length=32)]


class MemberView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: EntityId
    role: CompanyRole
    status: Literal["active", "suspended"]
    created_at: Timestamp
