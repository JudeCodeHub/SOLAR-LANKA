"""Company profile fields; publication is controlled by the review workflow."""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.core.value_types import EntityId, Timestamp

CompanyName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


District = Literal[
    "Ampara",
    "Anuradhapura",
    "Badulla",
    "Batticaloa",
    "Colombo",
    "Galle",
    "Gampaha",
    "Hambantota",
    "Jaffna",
    "Kalutara",
    "Kandy",
    "Kegalle",
    "Kilinochchi",
    "Kurunegala",
    "Mannar",
    "Matale",
    "Matara",
    "Monaragala",
    "Mullaitivu",
    "Nuwara Eliya",
    "Polonnaruwa",
    "Puttalam",
    "Ratnapura",
    "Trincomalee",
    "Vavuniya",
]
Service = Literal[
    "installation", "maintenance", "repair", "battery_installation", "site_assessment"
]
CredentialText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


class DeclaredCredential(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CredentialText
    issuer: CredentialText
    verification_status: Literal["company_declared"] = "company_declared"


class CompanyProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CompanyName | None = None
    service_districts: list[District] | None = Field(default=None, max_length=25)
    services: list[Service] | None = Field(default=None, max_length=5)
    declared_credentials: list[DeclaredCredential] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_patch(self) -> Self:
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError(
                "Supply at least one field; null is not allowed. Use [] to clear lists."
            )
        for field in ("service_districts", "services"):
            values = getattr(self, field)
            if values is not None and len(values) != len(set(values)):
                raise ValueError("Duplicate selections are not allowed")
        return self


class CompanyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    name: str
    publication_status: Literal["draft", "pending", "approved", "rejected"]
    service_districts: list[District]
    services: list[Service]
    declared_credentials: list[DeclaredCredential]
    created_at: Timestamp
