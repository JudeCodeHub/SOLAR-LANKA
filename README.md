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

### Known limitations

- Everything uses fictional companies and sample prices. Estimates are planning aids, not guarantees.
- Arcjet and Inngest were tested with fakes or locally, not against live services.
- Not yet built: technician visits, support cases, education content, PDF export, email, and all deployment work (later phases).
