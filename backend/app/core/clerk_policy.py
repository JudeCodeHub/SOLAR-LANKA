"""Clerk identity integration contract, reviewed 2026-09-24."""

CLERK_SDK_PACKAGE = "clerk-backend-api"
CLERK_ACCEPTED_TOKEN_TYPES = ("session_token",)
CLERK_MAX_CLOCK_SKEW_MS = 5_000
CLERK_REQUIRED_CLAIMS = ("iss", "sub", "sid", "exp", "nbf", "iat", "azp")
