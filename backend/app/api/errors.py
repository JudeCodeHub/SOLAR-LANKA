"""Shared handlers expose stable public errors, never raw exception details."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.api.schemas.errors import (
    ERROR_STATUS_CODES,
    ApiError,
    ErrorCode,
    ErrorResponse,
    ValidationIssue,
)

logger = logging.getLogger(__name__)

PUBLIC_MESSAGES = {
    ErrorCode.BAD_REQUEST: "The request could not be processed.",
    ErrorCode.UNAUTHENTICATED: "Authentication is required.",
    ErrorCode.FORBIDDEN: "You do not have permission to perform this action.",
    ErrorCode.NOT_FOUND: "The requested resource was not found.",
    ErrorCode.METHOD_NOT_ALLOWED: "This request method is not allowed.",
    ErrorCode.CONFLICT: "The action conflicts with the current resource state.",
    ErrorCode.VALIDATION_ERROR: "Request validation failed.",
    ErrorCode.RATE_LIMITED: "Too many requests. Please try again later.",
    ErrorCode.INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
    ErrorCode.SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
}
VALIDATION_MESSAGES = {
    "missing": "This field is required.",
    "greater_than": "Value must be greater than the permitted minimum.",
    "greater_than_equal": "Value must be at least the permitted minimum.",
    "less_than": "Value must be less than the permitted maximum.",
    "less_than_equal": "Value must not exceed the permitted maximum.",
    "int_parsing": "Enter a valid integer.",
    "string_type": "Enter a valid string.",
    "extra_forbidden": "Unexpected fields are not allowed.",
    "json_invalid": "The request body must contain valid JSON.",
}


class BusinessConflict(Exception):
    """An expected state conflict; callers supply a fixed, user-safe message only."""

    def __init__(self, public_message: str = PUBLIC_MESSAGES[ErrorCode.CONFLICT]) -> None:
        self.public_message = public_message.strip() or PUBLIC_MESSAGES[ErrorCode.CONFLICT]
        super().__init__(self.public_message)


def error_response(
    code: ErrorCode,
    *,
    message: str | None = None,
    issues: list[ValidationIssue] | None = None,
    headers: dict[str, str] | None = None,
    status_code: int | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        error=ApiError(code=code, message=message or PUBLIC_MESSAGES[code], issues=issues or [])
    )
    return JSONResponse(
        status_code=status_code or body.status_code,
        content=body.model_dump(mode="json"),
        headers=headers,
    )


async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    issues = []
    for error in exc.errors():
        kind = error.get("type", "invalid_value")
        code = kind if kind in VALIDATION_MESSAGES else "invalid_value"
        # Extra field names and malformed JSON offsets can originate in submitted input.
        location = list(error.get("loc", ()))
        if kind in {"extra_forbidden", "json_invalid"}:
            location = location[:1]
        issues.append(
            ValidationIssue(
                location=location,
                code=code,
                message=VALIDATION_MESSAGES.get(code, "Enter a valid value."),
            )
        )
    if not issues:
        issues.append(ValidationIssue(code="invalid_value", message="Enter a valid value."))
    return error_response(ErrorCode.VALIDATION_ERROR, issues=issues)


async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    code = next(
        (code for code, status in ERROR_STATUS_CODES.items() if status == exc.status_code),
        ErrorCode.INTERNAL_ERROR if exc.status_code >= 500 else ErrorCode.BAD_REQUEST,
    )
    headers = {
        key: value
        for key, value in (exc.headers or {}).items()
        if key.lower() in {"www-authenticate", "retry-after", "allow"}
    }
    if code == ErrorCode.VALIDATION_ERROR:
        return error_response(
            code,
            issues=[ValidationIssue(code="invalid_value", message="Enter a valid value.")],
            headers=headers,
        )
    return error_response(code, headers=headers, status_code=exc.status_code)


async def handle_business_conflict(request: Request, exc: BusinessConflict) -> JSONResponse:
    return error_response(ErrorCode.CONFLICT, message=exc.public_message)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    # Do not log exception strings, SQL, request bodies, query strings, or credentials.
    logger.error("Unexpected request failure")
    return error_response(ErrorCode.INTERNAL_ERROR)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(HTTPException, handle_http_error)
    app.add_exception_handler(BusinessConflict, handle_business_conflict)
    app.add_exception_handler(Exception, handle_unexpected_error)
