"""Clerk identity integration contract, reviewed 2026-09-24.

Flow: Next.js obtains a Clerk session token and sends Authorization: Bearer
<token> to FastAPI. The backend verifies it, maps verified `sub` to a local user,
and applies local account-status, role, membership, and ownership checks.
Unverified claims and frontend-selected roles are never authoritative.

Supported Python package: clerk-backend-api. Integration entry points:
  clerk_backend_api.security.authenticate_request
  clerk_backend_api.security.types.AuthenticateRequestOptions
Pass the FastAPI request (compatible headers interface) and require successful
RequestState.is_authenticated before using its payload. Require an explicit
Bearer header; do not silently fall back to cookie authentication.

Verification policy for implementation in 3.03:
- Accept only session_token; explicitly set accepts_token, whose reviewed Python
  default is broader. Do not accept machine/API/OAuth tokens for customer routes.
- Verify the RS256 signature with this Clerk instance's configured public JWT key
  or SDK-managed JWKS fetched using its server-only secret key. Never use an
  unverified token's issuer to choose a key URL. Plan for signing-key rotation.
- Require `iss` to exactly equal the configured Clerk instance issuer AFTER
  signature verification. Reviewed Python SDK code disables issuer validation;
  an application-level issuer check is therefore mandatory.
- Require numeric exp/nbf/iat and nonempty sub/sid. Reject missing claims, expired
  tokens, and future nbf/iat, using at most 5000 ms clock skew. SDK time validation
  alone is not a substitute for checking that required claims exist.
- Always set authorized_parties to explicit frontend origins, e.g.
  http://localhost:3000 in development. Require azp in that allowlist; no wildcard.
- Audience is optional only when the chosen Clerk session token has no aud.
  If an API audience is configured, pass audience to the SDK and require aud to
  match it. Never invent an audience or disable validation to accept a mismatch.
- Invalid/missing identity returns the shared 401 contract; authenticated users
  lacking application permission receive 403. Verification outages fail closed
  with a safe error; never log bearer tokens, secrets, or full claims.

Configuration needed before enabling protected routes: expected issuer, allowed
frontend origins, signing key or secret key, and audience when configured in Clerk.
Pin and inspect the installed SDK version in 3.03; this review used upstream main,
not a locally installed SDK or a live Clerk tenant. Authentication is not wired yet.

Official sources:
https://clerk.com/articles/how-to-add-authentication-to-a-python-backend
https://github.com/clerk/clerk-sdk-python/blob/main/src/clerk_backend_api/security/types.py
https://github.com/clerk/clerk-sdk-python/blob/main/src/clerk_backend_api/security/verifytoken.py
https://github.com/clerk/clerk-sdk-python/blob/main/src/clerk_backend_api/security/authenticaterequest.py
"""

CLERK_SDK_PACKAGE = "clerk-backend-api"
CLERK_ACCEPTED_TOKEN_TYPES = ("session_token",)
CLERK_MAX_CLOCK_SKEW_MS = 5_000
CLERK_REQUIRED_CLAIMS = ("iss", "sub", "sid", "exp", "nbf", "iat", "azp")
