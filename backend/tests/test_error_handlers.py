from collections.abc import Iterator

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.errors import BusinessConflict
from app.api.schemas.errors import ErrorResponse
from app.core.config import Settings
from app.main import create_app

SECRET = "private-password-and-sql"


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quantity: int = Field(gt=0)
    value: str

    @field_validator("value")
    @classmethod
    def reject_secret(cls, value: str) -> str:
        raise ValueError(f"Internal detail: {value}")


@pytest.fixture
def error_client() -> Iterator[TestClient]:
    app = create_app(Settings(_env_file=None, environment="test"))

    @app.get("/unexpected")
    async def unexpected() -> None:
        raise RuntimeError(SECRET)

    @app.get("/broken-response", response_model=dict[str, int])
    async def broken_response():
        return {"value": SECRET}

    @app.get("/conflict")
    async def conflict() -> None:
        raise BusinessConflict("This quotation has expired. Request a revised offer.")

    @app.get("/http/{status_code}")
    async def http_error(status_code: int) -> None:
        raise HTTPException(
            status_code=status_code,
            detail={"internal": SECRET},
            headers={"Retry-After": "30", "WWW-Authenticate": "Bearer", "X-Internal": SECRET},
        )

    @app.post("/validate")
    async def validate(payload: Payload) -> None:
        return None

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


@pytest.mark.parametrize("path", ["/unexpected", "/broken-response", "/http/500"])
def test_unexpected_errors_never_expose_internal_details(
    error_client: TestClient, path: str, caplog: pytest.LogCaptureFixture
) -> None:
    response = error_client.get(path)
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "An unexpected error occurred. Please try again later.",
            "issues": [],
        }
    }
    assert SECRET not in response.text
    assert SECRET not in caplog.text
    assert "traceback" not in response.text.lower()


def test_validation_sanitises_custom_messages_and_submitted_values(
    error_client: TestClient,
) -> None:
    response = error_client.post(
        "/validate", json={"quantity": 0, "value": SECRET, SECRET: "extra"}
    )
    assert response.status_code == 422
    body = ErrorResponse.model_validate(response.json())
    assert body.error.code == "validation_error"
    assert body.error.issues[0].location == ["body", "quantity"]
    assert SECRET not in response.text
    assert '"input"' not in response.text
    assert '"ctx"' not in response.text


def test_malformed_json_uses_error_contract(error_client: TestClient) -> None:
    response = error_client.post(
        "/validate", content='{ "private":', headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert ErrorResponse.model_validate(response.json()).error.code == "validation_error"


def test_business_conflict_returns_explicit_safe_message(error_client: TestClient) -> None:
    response = error_client.get("/conflict")
    assert response.status_code == 409
    assert response.json()["error"]["message"] == (
        "This quotation has expired. Request a revised offer."
    )


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "bad_request"),
        (401, "unauthenticated"),
        (403, "forbidden"),
        (404, "not_found"),
        (409, "conflict"),
        (422, "validation_error"),
        (429, "rate_limited"),
        (503, "service_unavailable"),
    ],
)
def test_http_errors_have_safe_envelope_and_preserve_protocol_headers(
    error_client: TestClient, status: int, code: str
) -> None:
    response = error_client.get(f"/http/{status}")
    assert response.status_code == status
    assert ErrorResponse.model_validate(response.json()).error.code == code
    assert response.headers["retry-after"] == "30"
    assert response.headers["www-authenticate"] == "Bearer"
    assert "x-internal" not in response.headers
    assert SECRET not in response.text


def test_router_errors_and_openapi_use_shared_contract(error_client: TestClient) -> None:
    assert error_client.get("/missing").json()["error"]["code"] == "not_found"
    response = error_client.post("/conflict")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"
    assert "GET" in response.headers["allow"]
    schema = error_client.get("/openapi.json").json()
    for code in ("422", "409", "500"):
        response_schema = schema["paths"]["/validate"]["post"]["responses"][code]
        assert response_schema["content"]["application/json"]["schema"]["$ref"].endswith(
            "/ErrorResponse"
        )
