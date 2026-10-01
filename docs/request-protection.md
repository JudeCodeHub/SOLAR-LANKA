# Request protection design (Arcjet)

Checklist item: 12.06. Implementation of the rules and tests follows in 12.07; production verification follows in 20.06.

## Decision

Use the **Arcjet Python SDK (`arcjet`, async client) inside FastAPI**. Protection is applied by a FastAPI dependency on selected routes, so the check runs in the same process that owns the data.

This replaces the "protected Next.js gateway" fallback in [Solar_Lanka_Tech_Stack.md](../Solar_Lanka_Tech_Stack.md) section 4. The gateway is not needed because a supported Python integration exists.

### Verified facts (checked 2026-10-01)

- Arcjet documents a Python + FastAPI integration at <https://docs.arcjet.com/reference/python>.
- PyPI package `arcjet` 1.2.0 requires Python >= 3.10. It is a pure-Python wheel.
- Native dependencies `pyqwest` 0.9.0 and `wasmtime` 47.x publish `manylinux` wheels, and `pyqwest` also publishes `cp314` wheels, so the pinned Python 3.14 is covered. Confirm with `uv lock` in 12.07 before relying on this.
- The SDK is documented for glibc Linux, macOS and Windows. **Alpine/musl is not supported.** The Phase 20 backend image must use a Debian/glibc base.
- Arcjet is designed to fail open: service problems return an `ERROR` decision rather than blocking. The default client timeout is 2000 ms and is configurable with `timeout_ms`.
- Client IP is read from the framework request. Behind proxies, trusted proxy addresses must be configured so a client cannot spoof its address.

## Ingress boundary

```text
Browser -> single public origin (reverse proxy / Next.js, /api -> FastAPI)
        -> FastAPI: Arcjet dependency -> Clerk identity -> role/company checks -> service
```

How direct bypass is prevented:

1. **No second path to the same code.** The check is a route-level dependency inside FastAPI. Reaching a protected handler without passing the check is not possible, whichever host or port the request arrives on. A gateway design would not give this guarantee.
2. **Single public origin.** In deployment only the reverse proxy is public. FastAPI listens on a private network. Locally, `compose.yaml` already binds services to `127.0.0.1`.
3. **No unprotected duplicates.** Protection is attached to the routers listed below, not to individual handlers, so a new write route on a protected router inherits it. 12.07 adds a test that enumerates the application's routes and fails if a route in the protected set lacks the dependency.
4. **Trusted proxies.** Arcjet's per-client limits depend on the real client IP. The proxy's addresses are configured as trusted; forwarded-IP headers from anyone else are ignored. Without this, an attacker could rotate `X-Forwarded-For` to dodge limits.
5. **Arcjet is not authentication.** Clerk verification, ownership/company checks, validation and database constraints still run on every request.

## Protected operations (candidates for 12.07)

| Route | Actor | Why | Planned rule type |
|---|---|---|---|
| `POST /estimates/preview` | Visitor (public) | Anonymous and CPU-bound | Rate limit by IP, bot detection |
| `POST /users/me/estimates` | Customer | Writes snapshots | Rate limit by user |
| `POST /users/me/requests` | Customer | Fans out to companies; spam risk | Rate limit by user (deduplication stays in the service) |
| `POST /media/upload-requests` | Authenticated | Issues storage upload permission | Rate limit by user |
| Quotation revision creation | Company staff | Document/notification generation | Rate limit by user, only if time permits |

Rule values (limits, windows) are chosen and tested in 12.07.

Not protected by Arcjet:

- `/health` and `/readiness`, which stay cheap for probes.
- `/webhooks/*` and the Inngest callback. These authenticate with their own signatures (Clerk webhook secret, Inngest signing key). Rate limiting them would risk dropping legitimate retries.

## Outage behaviour (to be implemented and tested in 12.07)

Proposed policy, subject to confirmation in 12.07:

- Timeout: 1000 ms, lower than the 2000 ms default so users are not stalled by a slow provider.
- Public anonymous route (`/estimates/preview`): **fail open**. The estimator is cheap enough that availability matters more than protection during an outage.
- Authenticated write routes: **fail open**, with an error log. Clerk identity, per-record permissions and database deduplication still limit abuse, and the demo should stay usable.
- Every `ERROR` decision is logged without request bodies or credentials.
- Development and test: when `SOLAR_ARCJET_KEY` is unset, protection is disabled explicitly with a startup log line. In production a missing key is a startup error, matching how missing Inngest keys are handled.
- Tests must not call the Arcjet network service. They use a fake client that returns allow, deny and error decisions.

## Configuration additions (12.07)

- `SOLAR_ARCJET_KEY` (secret), `SOLAR_ARCJET_TIMEOUT_MS`, and a trusted-proxy list.
- Dummy values added to `backend/.env.example`. No real key in source control.

## Open items

- Whether the Arcjet Next.js SDK is also used for page-level bot protection later. This is optional and does not affect API protection.
- Plan limits of Arcjet's free tier must be checked before deployment (20.03); no unlimited usage is assumed.
