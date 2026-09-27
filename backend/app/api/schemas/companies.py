"""Company profile fields; publication is controlled by the review workflow."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.core.value_types import EntityId, Timestamp

CompanyName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class CompanyProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CompanyName


class CompanyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    name: str
    publication_status: Literal["draft", "pending", "approved", "rejected"]
    created_at: Timestamp
