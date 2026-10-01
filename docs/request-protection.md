# Request protection design (Arcjet)

Checklist items: 12.06 (design) and 12.07 (implementation). Production verification of the ingress boundary follows in 20.06.

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
3. **No unclassified write routes.** The dependency is attached per route, because these routers also hold read routes that stay unlimited. `tests/test_request_protection.py` walks the four routers and fails if a state-changing route is neither protected nor in an explicit exemption list, so a new write route forces a decision.
4. **Trusted proxies.** Arcjet's per-client limits depend on the real client IP. The proxy's addresses are configured as trusted; forwarded-IP headers from anyone else are ignored. Without this, an attacker could rotate `X-Forwarded-For` to dodge limits.
5. **Arcjet is not authentication.** Clerk verification, ownership/company checks, validation and database constraints still run on every request.

## Protected operations (implemented in 12.07)

| Route | Actor | Why | Rule (all in `app/core/request_protection.py`) |
|---|---|---|---|
| `POST /estimates/preview` | Visitor (public) | Anonymous and CPU-bound | 30 requests/60 s per IP, bot detection |
| `POST /users/me/estimates` | Customer | Writes snapshots | 20 requests/60 s per user |
| `POST /users/me/requests` | Customer | Fans out to companies; spam risk | 10 requests/60 s per user (deduplication stays in the service) |
| `POST /media/upload-requests` | Authenticated | Issues storage upload permission | 20 requests/60 s per user |

Limits are demo-scale starting points, not measured capacity. User-keyed limits use the verified Clerk subject, never a client-supplied identifier, and run after token verification, so an invalid token gets 401 without reaching Arcjet. Quotation revision creation is not limited yet; add it with the document-generation work in Phase 19 if needed.

Exempt state-changing routes: `POST /users/me/requests/{request_id}/withdraw` and `POST /media/attachments`. Both are bounded by ownership checks and database state.

Not protected by Arcjet:

- `/health` and `/readiness`, which stay cheap for probes.
- `/webhooks/*` and the Inngest callback. These authenticate with their own signatures (Clerk webhook secret, Inngest signing key). Rate limiting them would risk dropping legitimate retries.

## Outage behaviour (implemented and tested in 12.07)

- Timeout: `SOLAR_ARCJET_TIMEOUT_MS`, default 1000 ms (allowed 100-5000), lower than the SDK default of 2000 ms so users are not stalled by a slow provider.
- Public anonymous route (`/estimates/preview`): **fail open**. The estimator is cheap enough that availability matters more than protection during an outage.
- Authenticated write routes: **fail open**, with a warning log. Clerk identity, per-record permissions and database deduplication still limit abuse, and the demo should stay usable.
- A policy can opt into fail closed (`fail_open=False`, answering 503). No current route does; the behaviour is tested so a future sensitive route can use it.
- Every provider error or exception is logged as one line naming the policy, with no request data, headers or exception text.
- Development and test: when `SOLAR_ARCJET_KEY` is unset, protection is disabled with a startup warning. In production a missing key stops `create_app`, matching how missing Inngest keys are handled.
- Denials use the shared error contract: 429 `rate_limited` with `Retry-After` set to the window length, or 403 `forbidden` for bot denials.
- Tests must not call the Arcjet network service. They use a fake client that returns allow, deny and error decisions.

## Configuration (12.07)

- `SOLAR_ARCJET_KEY` (secret), `SOLAR_ARCJET_TIMEOUT_MS` and `SOLAR_ARCJET_TRUSTED_PROXIES`, documented with dummy values in `backend/.env.example`. No real key in source control.
- `arcjet==1.2.0` is pinned in `backend/pyproject.toml`. It installed from the lockfile on Python 3.14 with manylinux wheels.
- Browser end-to-end runs (17.01) leave the key unset, because bot detection can block headless browsers.

## Known limitations

- Arcjet's service was not called in any test; tests use a fake client. Real-key behaviour (limits actually tripping, bot detection, proxy IP handling) must be checked manually with a development key and again in 20.06.
- In SDK 1.2.0, `Arcjet.aclose()` leaves an un-awaited coroutine and emits a `RuntimeWarning`. It is harmless at shutdown; revisit when upgrading the SDK.

## Open items

- Whether the Arcjet Next.js SDK is also used for page-level bot protection later. This is optional and does not affect API protection.
- Plan limits of Arcjet's free tier must be checked before deployment (20.03); no unlimited usage is assumed.
