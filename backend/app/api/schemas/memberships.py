"""Explicit company-role inputs; platform roles cannot be assigned here."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.value_types import EntityId

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
