"""Exercise real SDK signature verification with ephemeral RSA keys."""

from time import time
from typing import Annotated

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends
from fastapi.testclient import TestClient

from app.core.auth import VerifiedIdentity, require_identity
from app.core.config import Settings
from app.main import create_app


@pytest.fixture(scope="module")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def auth_client(signing_key):
    public = (
        signing_key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    app = create_app(
        Settings(
            _env_file=None,
            environment="test",
            clerk_issuer="https://clerk.example.test",
            clerk_authorized_parties=["http://localhost:3000"],
            clerk_jwt_key=public,
            clerk_audience="solar-api",
        )
    )

    @app.get("/protected")
    def protected(identity: Annotated[VerifiedIdentity, Depends(require_identity)]):
        return {"subject": identity.subject}

    with TestClient(app) as client:
        yield client


def token(signing_key, **overrides):
    now = int(time())
    claims = dict(
        iss="https://clerk.example.test",
        sub="user_test",
        sid="sess_test",
        azp="http://localhost:3000",
        aud="solar-api",
        exp=now + 60,
        nbf=now - 10,
        iat=now - 10,
    )
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, signing_key, algorithm="RS256")


def test_valid_identity(auth_client, signing_key):
    response = auth_client.get(
        "/protected", headers={"Authorization": f"Bearer {token(signing_key)}"}
    )
    assert response.status_code == 200
    assert response.json() == {"subject": "user_test"}


@pytest.mark.parametrize(
    "changes",
    [
        {"exp": 1},
        {"nbf": 9999999999},
        {"iat": 9999999999},
        {"iss": "https://other.test"},
        {"azp": "https://other.test"},
        {"aud": "other"},
        {"sub": ""},
        {"sid": ""},
        {"exp": "9999999999"},
        *({claim: None} for claim in ("iss", "sub", "sid", "exp", "nbf", "iat", "azp", "aud")),
    ],
)
def test_invalid_claims(auth_client, signing_key, changes):
    response = auth_client.get(
        "/protected", headers={"Authorization": f"Bearer {token(signing_key, **changes)}"}
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "unauthenticated"


@pytest.mark.parametrize(
    "header", [None, "Bearer malformed", "Basic abc", "Bearer", "Bearer ak_bad"]
)
def test_missing_or_malformed_token(auth_client, header):
    headers = {"Authorization": header} if header else {}
    assert auth_client.get("/protected", headers=headers).status_code == 401


def test_wrong_signature(auth_client):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert (
        auth_client.get(
            "/protected", headers={"Authorization": f"Bearer {token(other)}"}
        ).status_code
        == 401
    )


def test_cookie_is_not_authentication(auth_client, signing_key):
    response = auth_client.get("/protected", headers={"Cookie": f"__session={token(signing_key)}"})
    assert response.status_code == 401


def test_sdk_failure_is_safe(auth_client, monkeypatch):
    def fail(*args):
        raise RuntimeError("secret details")

    monkeypatch.setattr("app.core.auth.authenticate_request", fail)
    response = auth_client.get("/protected", headers={"Authorization": "Bearer token"})
    assert response.status_code == 401
    assert "secret details" not in response.text


@pytest.mark.parametrize("kind", ["missing", "malformed", "expired", "wrong_signature", "unsigned"])
def test_current_user_rejects_identity_before_database_access(auth_client, signing_key, kind):
    from app.db.session import get_session

    def forbidden_database_access():
        raise AssertionError("Invalid identities must not access user persistence")

    auth_client.app.dependency_overrides[get_session] = forbidden_database_access
    headers = {}
    if kind != "missing":
        if kind == "malformed":
            value = "malformed"
        elif kind == "expired":
            value = token(signing_key, exp=1)
        elif kind == "wrong_signature":
            other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            value = token(other_key)
        else:
            value = jwt.encode({"sub": "user_test"}, key="", algorithm="none")
        headers["Authorization"] = f"Bearer {value}"
    response = auth_client.get("/users/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"
    assert response.headers["www-authenticate"] == "Bearer"
    assert "set-cookie" not in response.headers


def test_duplicate_authorization_headers_are_rejected(auth_client, signing_key):
    bearer = f"Bearer {token(signing_key)}"
    response = auth_client.get(
        "/users/me",
        headers=[
            ("Authorization", bearer),
            ("Authorization", bearer),
        ],
    )
    assert response.status_code == 401
