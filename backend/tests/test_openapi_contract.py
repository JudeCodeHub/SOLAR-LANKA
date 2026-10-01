"""The generated OpenAPI document must describe auth and errors accurately."""

from collections import Counter

import pytest

from app.core.config import Settings
from app.main import create_app
from tests.test_request_protection import PROTECTED


@pytest.fixture(scope="module")
def schema() -> dict:
    return create_app(Settings(_env_file=None, environment="test")).openapi()


def operations(schema: dict):
    for path, item in schema["paths"].items():
        for method, operation in item.items():
            yield method.upper(), path, operation


def test_operations_are_unique_tagged_and_documented(schema):
    ids = Counter(operation["operationId"] for _, _, operation in operations(schema))
    assert [name for name, count in ids.items() if count > 1] == []
    for method, path, operation in operations(schema):
        assert operation.get("tags"), f"{method} {path} has no tag"
        assert operation.get("summary"), f"{method} {path} has no summary"


def test_internal_inngest_callback_is_not_public_api(schema):
    assert not [path for path in schema["paths"] if "inngest" in path]


def test_bearer_scheme_is_declared_only_where_identity_is_required(schema):
    assert schema["components"]["securitySchemes"]["HTTPBearer"]["scheme"] == "bearer"
    by_route = {(m, p): o for m, p, o in operations(schema)}
    assert "security" not in by_route[("GET", "/health")]
    assert "security" not in by_route[("POST", "/estimates/preview")]
    assert by_route[("GET", "/users/me")]["security"] == [{"HTTPBearer": []}]
    assert "401" in by_route[("GET", "/users/me")]["responses"]
    assert "401" not in by_route[("GET", "/health")]["responses"]


def test_rate_limit_response_is_listed_only_on_protected_routes(schema):
    limited = {(m, p) for m, p, o in operations(schema) if "429" in o["responses"]}
    assert limited == PROTECTED


def test_unreachable_method_not_allowed_is_not_listed(schema):
    assert all("405" not in o["responses"] for _, _, o in operations(schema))


def test_every_error_response_uses_the_shared_contract(schema):
    for method, path, operation in operations(schema):
        for code, response in operation["responses"].items():
            if code.startswith(("4", "5")):
                ref = response["content"]["application/json"]["schema"]["$ref"]
                assert ref.endswith("/ErrorResponse"), f"{method} {path} {code}"
