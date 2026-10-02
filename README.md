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
3. Layout is checked at 320 (small phone), 390 (phone), 768 (tablet), 1024 (tablet landscape) and 1280 (desktop) pixels wide: no sideways scrolling, and controls at least 24 px (WCAG 2.5.8; most are 44 px) at phone and tablet widths.
4. The demo people and what each can do are listed in `frontend/e2e/identities.ts`; `e2e/specs/foundation.spec.ts` checks that each one is who the table says and that the known data and the refusals are as expected.

## Core scope acceptance (Phase 1)

Each criterion from section 11 of the project scope, with the evidence for it. "Browser" means a Playwright test in `frontend/e2e/specs/`; backend files are in `backend/tests/`.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A reviewer can sign in with documented demo accounts for each supported role | Partly met | The seeds create the demo people (`app.seed_demo`, `app.seed_e2e`) and the API verifies Clerk tokens, but no passwords exist: a reviewer must create matching users in a Clerk development instance. Browser tests use a signed test token instead (`e2e/identities.ts`). Step-by-step instructions are 17.08. |
| 2 | Estimate, request, compare, accept, track | Met | Browser: `customer-acceptance.spec.ts` (estimate, request, offer, accept, tracking). API: `test_core_journey.py`. Saving an estimate from the page itself needs a real Clerk session and is covered through the API. |
| 3 | Company A cannot reach Company B's enquiries, quotations, notes or files | Met | Browser: `company-quotation.spec.ts`, `notifications-documents.spec.ts` (403 for other companies and technicians). API: `test_company_access.py`, `test_core_journey.py`. |
| 4 | Customers cannot read other customers' records by changing an id | Met | Browser: `foundation.spec.ts`, `notifications-documents.spec.ts` (404). API: `test_saved_estimate_access.py`, `test_request_reads.py`. |
| 5 | Catalogue filters and comparisons show consistent units and missing values | Met | Unit tests: `lib/catalogue/detail.test.ts`, `lib/comparison/table.test.ts`. API: `test_catalogue_public.py`, `test_comparison_favourites.py`. |
| 6 | Saved estimates keep the assumptions used | Met | `test_saved_estimate_snapshot.py`, `test_saved_estimate_history.py`, `test_estimator_config_admin.py` (published versions are immutable). |
| 7 | Quotation totals are calculated and validated by the backend | Met | `test_quotation_terms.py`, `test_quotation_edit_contract.py`; the browser form sends no totals (`company-quotation.spec.ts` reads the server's). |
| 8 | Sent revisions stay accessible and unchanged | Met | Database immutability in `test_migrations.py` and migration 0029; `test_quotation_current_read.py`; browser: the sent page offers no inputs (`company-quotation.spec.ts`). |
| 9 | Expired or superseded offers cannot be accepted | Met | `test_quotation_acceptance_policy.py`, `test_quotation_acceptance_transaction.py`; the screens explain refusals from fresh state (unit tests `lib/quotation/decision.test.ts`). |
| 10 | Concurrent acceptance cannot create two accepted offers for one request | Met | `test_quotation_acceptance_transaction.py::test_competing_acceptance_has_one_committed_winner` (real PostgreSQL); browser: the competing-offer test in `customer-acceptance.spec.ts`. |
| 11 | Implemented scheduling rejects conflicting technician visits | Deferred (Phase 2) | Technician workspace and site visits are not built, so there is nothing to conflict. |
| 12 | Invalid installation transitions are rejected with understandable errors | Met | API: `test_core_journey.py` (order and evidence rules), `test_quotation_states.py`; screens: `lib/installations/staff.test.ts` and the explanations from fresh state. |
| 13 | Private attachments require authorisation | Met | `test_private_media_routes.py`, `test_core_journey.py` (evidence), browser: `notifications-documents.spec.ts` (everyone else refused, signed out 401). |
| 14 | Critical workflows pass automated tests | Met | Backend suite (460 tests with `--database`), 302 frontend unit tests, 126 browser tests. |
| 15 | Works on desktop and mobile browser sizes | Met | Browser: `layout.spec.ts` (320 to 1280 px) and `accessibility.spec.ts` (axe, WCAG 2.2 AA). Emulated, not real devices. |
| 16 | Sample identities, prices and estimates are labelled | Met | Fictional names end in "(Fictional)" (`test_demo_seed.py`); prices carry "Sample price" and claims "Company declared, not verified"; the home page states the demonstration status; estimates say they are planning aids. |

### Deferred to Phase 2 or later (not part of the core release)

Technician workspace and conflict-checked site visits, support cases and sourced troubleshooting references, educational content, quotation document export, password recovery and scheduled reminders, expanded estimator scenarios (only grid-connected net metering without backup is calculated), and everything in Phase 3 and the deployment phase. The navigation shows Learn, Troubleshooting and Support only as "Coming soon" cards, never as links.

### Known limitations

- Everything uses fictional companies and sample prices. Estimates are planning aids, not guarantees.
- Arcjet and Inngest were tested with fakes or locally, not against live services.
- Not yet built: technician visits, support cases, education content, PDF export, email, and all deployment work (later phases).
