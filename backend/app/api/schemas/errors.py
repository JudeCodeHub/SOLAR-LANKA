"""Error response contract used by shared HTTP exception handlers.

Clients branch on `error.code`, not human-readable messages. A validation issue's
location follows the request path, e.g. ["body", "items", 0, "quantity"]. Messages
must be safe for public display: never include submitted values, SQL, credentials,
tracebacks, or raw exception strings. Domain conflicts use code `conflict` and a
safe actionable message. More specific conflict codes can be added when needed.
"""

from enum import StrEnum
from types import MappingProxyType
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    StringConstraints,
    model_validator,
)

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ErrorCode(StrEnum):
    BAD_REQUEST = "bad_request"
    UNAUTHENTICATED = "unauthenticated"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    METHOD_NOT_ALLOWED = "method_not_allowed"
    CONFLICT = "conflict"
    VALIDATION_ERROR = "validation_error"
    RATE_LIMITED = "rate_limited"
    INTERNAL_ERROR = "internal_error"
    SERVICE_UNAVAILABLE = "service_unavailable"


ERROR_STATUS_CODES = MappingProxyType(
    {
        ErrorCode.BAD_REQUEST: 400,
        ErrorCode.UNAUTHENTICATED: 401,
        ErrorCode.FORBIDDEN: 403,
        ErrorCode.NOT_FOUND: 404,
        ErrorCode.METHOD_NOT_ALLOWED: 405,
        ErrorCode.CONFLICT: 409,
        ErrorCode.VALIDATION_ERROR: 422,
        ErrorCode.RATE_LIMITED: 429,
        ErrorCode.INTERNAL_ERROR: 500,
        ErrorCode.SERVICE_UNAVAILABLE: 503,
    }
)


class ValidationIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location: list[StrictStr | StrictInt] = Field(default_factory=list)
    code: NonEmptyText
    message: NonEmptyText


class ApiError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: ErrorCode
    message: NonEmptyText
    issues: list[ValidationIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_issue_shape(self) -> Self:
        if self.code == ErrorCode.VALIDATION_ERROR and not self.issues:
            raise ValueError("Validation errors require at least one issue")
        if self.code != ErrorCode.VALIDATION_ERROR and self.issues:
            raise ValueError("Field issues are reserved for validation errors")
        return self


class ErrorResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "error": {
                        "code": "validation_error",
                        "message": "Request validation failed.",
                        "issues": [
                            {
                                "location": ["body", "items", 0, "quantity"],
                                "code": "greater_than",
                                "message": "Quantity must be greater than zero.",
                            }
                        ],
                    }
                },
                {
                    "error": {
                        "code": "conflict",
                        "message": "This quotation has expired. Request a revised offer.",
                        "issues": [],
                    }
                },
            ]
        },
    )

    error: ApiError

    @property
    def status_code(self) -> int:
        """HTTP status belongs to the response transport, not the JSON body."""
        return ERROR_STATUS_CODES[self.error.code]
