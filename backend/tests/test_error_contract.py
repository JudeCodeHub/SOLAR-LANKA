import pytest
from pydantic import ValidationError

from app.api.schemas.errors import ERROR_STATUS_CODES, ApiError, ErrorCode, ErrorResponse


def test_documented_validation_and_conflict_examples_are_valid() -> None:
    examples = ErrorResponse.model_json_schema()["examples"]
    assert len(examples) == 2
    responses = [ErrorResponse.model_validate(example) for example in examples]
    assert [response.status_code for response in responses] == [422, 409]
    for response, example in zip(responses, examples, strict=True):
        assert response.model_dump(mode="json") == example


def test_nested_validation_location_preserves_array_index() -> None:
    example = ErrorResponse.model_json_schema()["examples"][0]
    response = ErrorResponse.model_validate(example)
    assert response.error.issues[0].location == ["body", "items", 0, "quantity"]


def test_business_conflict_has_stable_code_and_no_field_issues() -> None:
    response = ErrorResponse(
        error=ApiError(code=ErrorCode.CONFLICT, message="Request already closed.")
    )
    assert response.status_code == 409
    assert response.model_dump(mode="json") == {
        "error": {"code": "conflict", "message": "Request already closed.", "issues": []}
    }


@pytest.mark.parametrize("extra_key", ["input", "ctx", "traceback", "sql"])
def test_unapproved_diagnostic_fields_are_rejected(extra_key: str) -> None:
    example = ErrorResponse.model_json_schema()["examples"][0]
    example["error"]["issues"][0][extra_key] = "sensitive value"
    with pytest.raises(ValidationError):
        ErrorResponse.model_validate(example)


def test_validation_requires_issues_and_other_errors_disallow_them() -> None:
    with pytest.raises(ValidationError):
        ApiError(code=ErrorCode.VALIDATION_ERROR, message="Invalid request.")
    example = ErrorResponse.model_json_schema()["examples"][0]
    example["error"]["code"] = "conflict"
    with pytest.raises(ValidationError):
        ErrorResponse.model_validate(example)


def test_unknown_codes_and_empty_messages_are_rejected() -> None:
    for code, message in [("unexpected_code", "Failure"), ("conflict", "   ")]:
        with pytest.raises(ValidationError):
            ApiError(code=code, message=message)
    assert set(ERROR_STATUS_CODES) == set(ErrorCode)
