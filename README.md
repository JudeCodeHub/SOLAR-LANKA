# Solar Lanka

Solar Lanka is a solar energy portfolio web application for exploring solar products, estimating system requirements, comparing company quotations, and tracking installation progress.

**Status: Under development.**

## Backend (Phase 1 API) — status: complete

The backend gate is passed: the core journey (estimate → request → compare → accept → track) works through the API, proven by `backend/tests/test_core_journey.py`. The frontend (Phase 13 onward) can begin.

### Run it

Run from `backend/`. Docker only provides PostgreSQL; no Make target manages containers.

1. Copy the root `.env.example` to `.env` and set both database passwords. Copy `backend/.env.example` to `backend/.env` and `backend/.env.test.example` to `backend/.env.test`, using the same passwords.
2. Install dependencies: `uv sync --locked --group dev` (from `backend/`). Start PostgreSQL from the repository root: `docker compose up -d postgres`, plus `docker compose --profile test up -d postgres-test` for tests.
3. Create the schema and demo data: `make migrate`, then `.venv/bin/python -m app.seed_demo` (safe to repeat).
4. Start the API: `.venv/bin/uvicorn app.main:create_app --factory --reload`. Interactive docs are at `/docs`; `/health` and `/health/ready` are probes.

### Verify it (the gate)

- `.venv/bin/ruff check . && .venv/bin/ruff format --check .`
- `make migrate-test`, then `.venv/bin/python -m pytest --database` (needs the test container). Without `--database` the PostgreSQL tests are skipped.
- `.venv/bin/python -m app.benchmark_demo` records demo-scale timings. Point `SOLAR_DATABASE_URL` at a disposable migrated and seeded database first.

### Integrations

All integration settings are backend-only and documented with dummy values in `backend/.env.example`.

- **Clerk** (identity): the API verifies Clerk bearer tokens and keeps roles and company memberships locally. Demo data creates no logins; create demo users in a Clerk development instance.
- **ImageKit** (public media): upload authorisation and verification; private documents use local private storage in development.
- **Inngest** (background work): notifications are produced from a database outbox. Use the Inngest Dev Server locally; production needs both keys.
- **Arcjet** (abuse protection): rate limits on public and write routes. Unset `SOLAR_ARCJET_KEY` disables it in development; production requires it.

## Browser tests (Phase 17)

Playwright runs the real web app against the real API and a known database. No Clerk account or password is needed: a test-only gateway signs a token for the demo person each test chooses, and the API still verifies it (the sign-in bypass works only when `E2E_AUTH=1` outside production).

1. Create a disposable PostgreSQL database in the test container and export its address. From `backend/`: `.venv/bin/python ../frontend/e2e/support/database.py create`, then `export E2E_DATABASE_URL=$(.venv/bin/python ../frontend/e2e/support/database.py url)` (it reads the passwords in the root `.env`; never print the address). `drop` removes it afterwards.
2. From `frontend/`: `node_modules/.bin/playwright test` (or `pnpm e2e`). It migrates and seeds the database (`app.seed_demo` plus `app.seed_e2e`, both repeatable), starts the API and the signing proxy, starts the web app, and uses the Chrome installed on the machine. Projects: desktop (1280 px), tablet (iPad) and mobile (Pixel 7).
3. The demo people and what each can do are listed in `frontend/e2e/identities.ts`; `e2e/specs/foundation.spec.ts` checks that each one is who the table says and that the known data and the refusals are as expected.

### Known limitations

- Everything uses fictional companies and sample prices. Estimates are planning aids, not guarantees.
- Arcjet and Inngest were tested with fakes or locally, not against live services.
- Not yet built: technician visits, support cases, education content, PDF export, email, and all deployment work (later phases).
