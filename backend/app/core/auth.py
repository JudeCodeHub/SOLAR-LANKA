"""Bearer-only Clerk verification dependency for protected API routes."""

from dataclasses import dataclass
from math import isfinite
from types import SimpleNamespace
from typing import Annotated

from clerk_backend_api.security import authenticate_request
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.clerk_policy import CLERK_MAX_CLOCK_SKEW_MS, CLERK_REQUIRED_CLAIMS
from app.core.config import Settings

# Declares the bearer scheme in OpenAPI only; require_identity does the real verification.
bearer_scheme = HTTPBearer(auto_error=False, description="Clerk session token")


@dataclass(frozen=True)
class VerifiedIdentity:
    subject: str
    session_id: str


def require_identity(
    request: Request,
    _documented_scheme: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> VerifiedIdentity:
    """Only return identity from verified claims; never trust submitted user IDs."""
    headers = request.headers.getlist("authorization")
    parts = headers[0].split() if len(headers) == 1 else []
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, headers={"WWW-Authenticate": "Bearer"})
    settings: Settings = request.app.state.settings
    if (
        not settings.clerk_issuer
        or not settings.clerk_authorized_parties
        or "*" in settings.clerk_authorized_parties
        or not (settings.clerk_jwt_key or settings.clerk_secret_key)
    ):
        raise HTTPException(503)
    options = AuthenticateRequestOptions(
        accepts_token=["session_token"],
        authorized_parties=settings.clerk_authorized_parties,
        audience=settings.clerk_audience,
        clock_skew_in_ms=CLERK_MAX_CLOCK_SKEW_MS,
        jwt_key=settings.clerk_jwt_key.get_secret_value() if settings.clerk_jwt_key else None,
        secret_key=settings.clerk_secret_key.get_secret_value()
        if settings.clerk_secret_key
        else None,
    )
    try:
        # Normalise the scheme for the SDK and exclude cookie fallback entirely.
        state = authenticate_request(
            SimpleNamespace(headers={"Authorization": f"Bearer {parts[1]}"}), options
        )
    except Exception:
        # SDK/network errors must fail closed without exposing tokens or configuration.
        raise HTTPException(401, headers={"WWW-Authenticate": "Bearer"}) from None
    claims = state.payload if state.is_authenticated else None
    if (
        not isinstance(claims, dict)
        or any(key not in claims for key in CLERK_REQUIRED_CLAIMS)
        or claims["iss"] != settings.clerk_issuer
        or claims["azp"] not in settings.clerk_authorized_parties
        or any(not isinstance(claims[k], str) or not claims[k].strip() for k in ("sub", "sid"))
        or any(
            type(claims[k]) not in (int, float) or not isfinite(claims[k])
            for k in ("exp", "nbf", "iat")
        )
    ):
        raise HTTPException(401, headers={"WWW-Authenticate": "Bearer"})
    return VerifiedIdentity(subject=claims["sub"], session_id=claims["sid"])
