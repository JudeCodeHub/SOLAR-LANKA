# Solar Lanka

Solar Lanka is a solar energy portfolio web application for exploring solar products, estimating system requirements, comparing company quotations, and tracking installation progress.

**Status: the core release (Phase 1) and the Phase 2 features are built and tested; deployment is a later phase, and a few follow-ups are listed under Known limitations.** Everything uses fictional companies and sample prices. Contents: [setup](#setup-from-a-fresh-checkout), [architecture](#architecture), [database diagram](#database-relationships), [API documentation](#api-documentation), [demo accounts](#demo-accounts), [walkthrough](#guided-walkthrough), [browser tests](#browser-tests-phase-17), [scope acceptance](#core-scope-acceptance-phase-1), [Phase 2 acceptance](#phase-2-acceptance-phases-18-and-19).

## Backend

The core journey (estimate → request → compare → accept → track) works through the API, proven by `backend/tests/test_core_journey.py`; the Phase 2 features (technician visits, support, troubleshooting, education, exports, email, reminders) sit on the same API, and the web app is built on it.

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
- **Inngest** (background work): notifications, quotation PDF exports and their emails are produced from a database outbox, and two scheduled functions run the reminders (hourly) and the export cleanup (daily, development and test). Use the Inngest Dev Server locally; production needs both keys. Without it, `python -m app.jobs.process_outbox_locally`, `python -m app.jobs.send_reminders` and `python -m app.jobs.cleanup_exports` do the same work once.
- **Email**: a local file sink by default and SMTP when configured; see Email below.
- **Arcjet** (abuse protection): rate limits on public and write routes. Unset `SOLAR_ARCJET_KEY` disables it in development; production requires it.

## Setup from a fresh checkout

Needs Docker (PostgreSQL only), Python with `uv`, Node with `pnpm`, and a free [Clerk](https://clerk.com) development instance for sign-in.

1. **Database and backend**: follow "Run it" above (root `.env` with two database passwords, `backend/.env` from `.env.example`, `uv sync --locked --group dev`, `docker compose up -d postgres`, `make migrate`, `.venv/bin/python -m app.seed_demo`, then `.venv/bin/python -m app.seed_e2e` for the extra demo people and a fictional estimator version). Both seeds can be repeated safely. Set the Clerk values in `backend/.env` (names are in `backend/.env.example`).
2. **Frontend**: in `frontend/`, copy `.env.example` to `.env`, fill the four Clerk values from the same Clerk instance and set `API_BASE_URL` to the backend address (for example `http://127.0.0.1:8000`), then `pnpm install` and `pnpm dev` (http://localhost:3000). The browser only ever calls this site's `/api` gateway, which adds the session token and forwards to the backend.
3. **Check it**: backend `.venv/bin/ruff check . && .venv/bin/python -m pytest --database` (needs `make migrate-test` and the test container); frontend `pnpm check`, `pnpm test`, `pnpm build`; browser tests as described below.

## Architecture

```mermaid
flowchart LR
  B[Browser] -->|same-origin /api| N[Next.js 16 app<br/>pages, TanStack Query, Clerk session]
  N -->|bearer token added server-side| A[FastAPI<br/>verifies Clerk token, applies roles and company membership]
  A --> P[(PostgreSQL<br/>constraints and triggers keep sent quotations frozen)]
  A -->|outbox rows| O[Inngest worker<br/>notifications, PDF exports, emails, reminders]
  O --> P
  O -.->|email| M[Mail sink files<br/>or SMTP]
  A -.->|private evidence, photos and exports| F[Local private storage<br/>development only]
  A -.->|public images| I[ImageKit]
  N --> C[Clerk<br/>sign-in only]
```

Roles: an account is a customer or a platform administrator; company administrators, sales and technicians are explicit memberships. Every company route checks the membership, every customer route checks ownership, and the frontend only hides what the backend would refuse anyway. Quotation totals, state changes and acceptance are decided by the backend in one transaction; the pages re-read after every refusal and explain from fresh state.

## Database relationships

```mermaid
erDiagram
  app_users ||--o{ company_memberships : "belongs through"
  companies ||--o{ company_memberships : has
  companies ||--o{ company_reviews : "review history"
  companies ||--o{ product_offers : "sells (price and claim)"
  products ||--o{ product_offers : "offered as"
  products ||--o| panels : "kind panel"
  products ||--o| inverters : "kind inverter"
  products ||--o{ product_sources : "cited by"
  app_users ||--o{ favourites : saves
  products ||--o{ favourites : "saved as"
  estimator_config_versions ||--o{ saved_estimates : "snapshot of"
  app_users ||--o{ saved_estimates : owns
  app_users ||--o{ quotation_requests : sends
  saved_estimates ||--o{ quotation_requests : "may start"
  quotation_requests ||--o{ request_deliveries : "sent to"
  companies ||--o{ request_deliveries : receives
  request_deliveries ||--o| quotations : "answered by"
  quotations ||--o{ quotation_revisions : "versions"
  quotation_revisions ||--o{ quotation_line_items : "itemised by"
  products ||--o{ quotation_line_items : "snapshot of"
  quotation_revisions ||--o| installations : "accepted creates"
  installations ||--o{ installation_milestones : "8 ordered steps"
  installation_milestones ||--o{ installation_milestone_events : "history"
  installations ||--o{ installation_internal_notes : "company only"
  request_deliveries ||--o{ request_delivery_notes : "company only"
  app_users ||--o{ notifications : receives
  app_users ||--o{ media_assets : uploads
  app_users ||--o{ audit_events : "acts in"
  outbox_events }o--|| installations : "announces"
  installations ||--o{ installation_assignments : "staff on the job"
  installations ||--o{ site_visits : "visits"
  site_visits ||--o{ site_visit_slots : "times offered"
  site_visits ||--o{ site_visit_events : history
  site_visits ||--o{ site_visit_notes : "notes"
  site_visits ||--o{ site_visit_evidence : "photos"
  products ||--o{ troubleshooting_references : "exact model"
  installations ||--o{ support_cases : "problems reported"
  support_cases ||--o{ support_case_updates : "history"
  support_cases ||--o{ support_case_attachments : "photos"
  support_cases ||--o{ support_case_assignments : "technician"
  education_categories ||--o{ articles : groups
  quotation_revisions ||--o{ quotation_exports : "PDF made once"
  app_users ||--o{ quotation_exports : requests
  app_users ||--o| notification_preferences : "own switches"
  app_users ||--o{ email_deliveries : "emailed once"
```

The diagram shows the relationships that matter; the full column lists are in `backend/app/models/`. Table names follow the models. Companies' prices live in `product_offers`, never on the canonical `products`, and sent quotation revisions and their lines are made immutable by database triggers (migration 0029).

## API documentation

The API documents itself. With the backend running, interactive docs are at `/docs` (Swagger) and `/redoc`, and the machine-readable schema is `GET /openapi.json`. `.venv/bin/python -m app.export_openapi FILE` writes it to a file, and `pnpm api:types` in `frontend/` turns it into the typed client (`src/lib/api/schema.d.ts`), so the frontend cannot drift from the backend without a type error. Errors always look like `{"error": {"code", "message", "issues"}}`. Route groups: public catalogue, directory and estimate preview; `/users/me/...` (customer: estimates, requests, offers, installations, notifications); `/companies/{id}/...` (company staff); `/admin/...` and `/audit-events` (platform administrators); `/media/...` (uploads and private downloads).

## Estimator scenarios

Each scenario has its own published configuration (`grid_net_metering_no_backup`, `grid_net_accounting_no_backup`, `grid_net_plus_no_backup`) and an estimate only ever uses the latest published, unarchived version for its own connection scheme. Saved estimates keep the input, the full configuration (assumptions and source snapshots) and the result as they were, so publishing a newer version never changes them. Scheme descriptions: PUCSL, [Rooftop Solar PV Connection Schemes](https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/) (last updated 2023-10-10; it still lists the older 27.06 LKR/kWh rate, so do not use its rates). Feed-in rate checked 2026-10-04 against the Commission's [Decision on Feed in Tariffs](https://www.pucsl.gov.lk/wp-content/uploads/2026/08/Full-Final-Decision-on-Feed-in-Tariffs-August-2026.pdf) and its Annex 2: new rooftop solar up to 10 kW is 23.11 LKR/kWh (19.15 above 10 and up to 40 kW, 17.11 above 40 and up to 250 kW, 15.81 above 250 kW), effective 2026-08-25 "until the next tariff revision" (news reports give 2027-02-24 as the end of validity; the decision text I read does not). The same decision quotes the National Electricity Policy: new on-grid rooftop agreements are on a "net plus" basis. News reports say the Ministry of Energy stopped net metering and net accounting for new connections from 2026-09-11; I did not read that directive, so treat it as reported. The rate in a configuration carries its own `effective_from` date and must be rechecked.

| Scenario | Monthly value used | Worked example (300 kWh used, 250 kWh generated, 50% daytime use, 23.11 LKR/kWh, sample tariff) |
|---|---|---|
| Net metering | Excess is banked, not paid: the bill is recomputed on consumption minus generation | 5 090 LKR (bill falls from 5 500 to 410) |
| Net accounting | Daytime use offsets imports; the remainder is paid at the feed-in rate | 150 kWh used directly gives bill 2 500; 100 kWh exported earns 2 311; 5 500 - 2 500 + 2 311 = 5 311 LKR |
| Net plus | All generation is sold at the feed-in rate; the household bill is unchanged | 250 x 23.11 = 5 777.50 LKR |

Net accounting and net plus need an `export` source snapshot with an `effective_from` date and an `export_rate_lkr_per_kwh` low/high range in the configuration; without them (or, for net accounting, without the daytime-use percentage) the savings are left out rather than guessed. Net plus plus (power-plant arrangement above contract demand, roof rental, aggregators) is not modelled, and off-grid and hybrid systems have no sourced sizing data, so all three stay refused.

## Email

Every in-app notification is also emailed once, unless the person has switched email off on the Notifications page. By default (`SOLAR_MAIL_BACKEND=sink`) messages are written as files under `backend/storage/mail`, to the fictional address `<clerk subject>@example.test`, so nothing needs an account. To send for real, set `SOLAR_MAIL_BACKEND=smtp` with `SOLAR_SMTP_HOST`, `SOLAR_SMTP_PORT`, `SOLAR_SMTP_USERNAME`, `SOLAR_SMTP_PASSWORD` (STARTTLS is on unless `SOLAR_SMTP_STARTTLS=false`) and `SOLAR_CLERK_SECRET_KEY`, which is used to look up each person's primary address (the app stores none). The SMTP path is tested against an in-process SMTP server (`aiosmtpd`, a dev dependency) rather than a container; to watch messages in a tool such as Mailpit you start it yourself and point the SMTP settings at it (for example port 1025 with `SOLAR_SMTP_STARTTLS=false`), but that needs a real Clerk key for the address lookup and was not tried here.

## Try it with a real Clerk instance

The browser tests bypass sign-in, so this is the check that exercises Clerk itself. It is opt-in and uses a test user you create yourself in your Clerk development instance (the app never sees or stores passwords).

1. In the Clerk dashboard (User & authentication) switch on Email address and Password, and, for recovery, Email verification code. Leave Password reset by email code enabled.
2. Create a user with an email containing `+clerk_test`, for example `me+clerk_test@example.com`, and a password. In a development instance Clerk accepts the fixed code `424242` for such addresses, so no inbox is needed.
3. Link that user to a demo person before their first sign-in (see Demo accounts): copy the user id (starts with `user_`) and run `.venv/bin/python -m app.link_demo_account` as described there.
4. Start the stack as in Setup, open `/sign-in`, and sign in with the email and password. The header should change from Sign in to your account menu.
5. Recovery: on `/sign-in` enter the email, click Forgot password, choose to reset by email code, enter `424242` and set a new password.
6. To run the same steps automatically from `frontend/`: `LIVE_CLERK_EMAIL=... LIVE_CLERK_PASSWORD=... LIVE_CLERK_NEW_PASSWORD=... node_modules/.bin/playwright test -c playwright.live.config.ts`. Without those variables only the first test runs (the page is Clerk's own email and password form); the recovery test changes the user's password.

Delete the test user in the dashboard when you are done.

## Account and password recovery

Recovery is Clerk's; the app builds no reset tokens, reset pages or recovery tables. `/sign-in` renders Clerk's `<SignIn />`, which shows "Forgot password?" and emails a verification code once the Clerk instance allows it, and `/account` renders Clerk's `<UserProfile />` for changing the password or email while signed in. To enable it in your Clerk development instance, turn on the Password and Email verification code options under User & authentication (and keep email as an identifier). A unit test (`frontend/src/lib/recovery.test.ts`) fails if either page stops using Clerk's component or if any frontend or backend source or migration adds a password-reset or reset-token implementation. The local mail sink from 19.06 is not used for recovery: Clerk sends its own email.

## Demo accounts

The seeds create the people below with the roles and companies shown, but **no passwords exist**: sign-in is Clerk's. To sign in as one, create a user in your Clerk development instance, copy its user id (starts with `user_`) from the Clerk dashboard, and link it **before that user's first sign-in**:

```
cd backend
.venv/bin/python -m app.link_demo_account demo_seed_customer user_2abc...
```

| Demo subject | Role | Company | Use it to |
|---|---|---|---|
| `demo_seed_customer` | customer | none | follow the four seeded requests (draft, revised, expired and accepted offers) and the accepted installation |
| `demo_seed_company_a` | company administrator | Demo Sunbird Solar | answer enquiries, quote, manage installations |
| `demo_seed_company_b` | company administrator | Demo Moonleaf Energy | see another company's separate data |
| `demo_seed_company_c` | company administrator | Demo Lotus Solar | directory listing only |
| `e2e_sunbird_sales` | sales | Demo Sunbird Solar | same screens as the administrator, as sales |
| `e2e_sunbird_technician` | technician | Demo Sunbird Solar | open My visits (`/technician`) to see assigned site visits, add notes and photos, and complete a visit |
| `e2e_customer_new` | customer | none | every empty state |
| `e2e_customer_estimate`, `e2e_customer_two` | customer | none | run the whole workflow yourself without touching the seeded customer |
| `e2e_platform_admin` | platform administrator | none | review companies, edit the catalogue and estimator settings, read the audit log |
| `e2e_content_reviewer` | platform administrator | none | a second administrator, so learning articles can be reviewed by someone other than their author |
| `e2e_rival_admin` | company administrator | E2E Rival Solar | a second approved Colombo company, so offers can compete |

Anyone who signs in with a Clerk user that is not linked becomes an ordinary customer with no data.

## Guided walkthrough

Use two browser profiles (or a private window) so a customer and a company can be signed in at once.

1. **Browse without signing in**: Solar panels, Inverters (filters, then compare up to three; unknown values read "Not specified"), Companies, and Estimator (try 300 kWh a month, Colombo, 30 m², partial shading).
2. **As `e2e_customer_estimate`**: save the estimate, open My estimates, then Prepare a request from it and send it to Demo Sunbird Solar (and the rival, to see competing offers).
3. **As `demo_seed_company_a`**: open Enquiries, mark the enquiry opened, start a quotation draft, add lines, save (the totals come from the server) and send it. Try revising it to see the history.
4. **Back as the customer**: open the request, compare the offers (differences and "Not specified" are flagged, nothing is ranked), accept one. Try accepting the other: it is refused and explained.
5. **Track**: open the installation, then as the company start the first step, upload evidence and complete it, share a delay, and add an internal note. As the customer, see exactly what is shared, and that internal notes and evidence files are not.
6. **Notifications**: the customer sees each change under Notifications (the Inngest worker produces them; locally run it, or use the local processor `python -m app.jobs.process_outbox_locally`).
7. **As `e2e_platform_admin`**: review a company submission, edit a specification, publish a new estimator draft, and read the audit log.
8. **Site visit**: as `e2e_customer_estimate`, open the installation and request a visit with a time; as the company, confirm it with the technician (or offer other times); as `e2e_sunbird_technician`, open My visits, add a note and a photo and complete the visit once its time has come (the app refuses to complete a visit that has not started; for a demonstration, a visit scheduled for the past can only be made by editing its time in the database, which the browser tests do for you).

9. **Support and troubleshooting**: without signing in, open Troubleshooting and look up `GW3000-DNS-30` (hazards come first, each reference names its manual page; a similar name such as `GW3000-DNS` only offers names to pick from). As `e2e_customer_estimate`, open Support and report a problem on the installation (tick "may be dangerous" to see the safety message); as the company, assign `e2e_sunbird_technician`, who then sees only that case.
10. **Learning centre**: open Learn without signing in. Three articles (how rooftop solar works, connection schemes and the electricity bill) were checked against their cited pages and carry no sample label; the other four are still marked as sample. As `e2e_platform_admin` open Learning content to draft an article, then publish it as `e2e_content_reviewer`.
11. **Estimator schemes**: on the Estimator choose Net accounting or Net plus (with a daytime share for net accounting). The result names the scheme, says how it differs from net metering, and lists the feed-in rate with its date and source. As `e2e_platform_admin`, open Estimator settings to draft a version for a scheme (its export rate and a dated export source are required).
12. **PDF copy**: as the customer, open an offer and choose Prepare PDF; it is made by the background job (run `python -m app.jobs.process_outbox_locally` locally), then Download PDF appears. The company can download any sent revision from its quotation page.
13. **Email and reminders**: every notification is also written as a file under `backend/storage/mail` (see Email). Run `python -m app.jobs.send_reminders` to create reminders for offers about to expire, visits within a day and yearly check-ins. On Notifications, switch reminders or email off for your own account.

### Measured demo performance (17.09)

Measured during Phase 17, on the core release before the Phase 2 features were added, on one developer laptop (Linux, PostgreSQL 16 in Docker, Python 3.14, Next.js production build), demo dataset only; they were not measured again after Phase 2. These are demonstration figures, not capacity claims.

| What | Result |
|---|---|
| Fresh database: all migrations | about 2.4 s |
| Seeds (`app.seed_demo`, `app.seed_e2e`, the second run changes nothing) | under a second each, no manual database edit |
| Production build of the web app | about 24 s |
| API reads in process (30 runs after warm-up, `python -m app.benchmark_demo`) | median 18 to 50 ms, 95th percentile 23 to 56 ms across 13 endpoints; 3 to 9 queries each; no sequential scans |
| Slowest read | company revision history, median 49.6 ms (9 queries) |
| Over HTTP, warm | API health 35 ms, readiness 85 ms, catalogue list 23 ms; web pages 10 to 85 ms from the production server (the first request after start took 330 to 380 ms) |

### Known limitations

- Everything uses fictional companies and sample prices. Estimates are planning aids, not guarantees.
- Arcjet, Inngest and SMTP were tested with fakes or local stand-ins, not against live services or a hosted provider.
- Sign-in is Clerk's: demo people have no passwords and must be linked to Clerk users (see Demo accounts). Browser tests bypass sign-in with a signed test token. A live check against a real Clerk development instance is written (see Try it with a real Clerk instance) but its sign-in and recovery steps have not been run.
- Content: three learning articles and the three troubleshooting references (one inverter model only) were read against their sources; four articles remain sample, and no content has had a human reviewer.
- Estimates: net plus plus, off-grid, hybrid and battery systems are not calculated. The feed-in rate is a single figure for any system size, and the schemes open to new connections are changing, so confirm them with a company.
- Private files (evidence, photos and PDF exports) use local storage, which exists for development and tests only. Notifications, exports, emails and reminders need the Inngest worker and its schedules (or the local jobs) running.
- Email links are not included (the app has no public address setting yet) and delivery is at least once.
- Measurements cover the demo dataset on one machine; nothing was load-tested, and no real device or screen reader was used.
- Not yet built: deployment, CI, production storage, backups and monitoring (the deployment phase).

## Local release gate

Last run on 2026-10-05 on one machine with a disposable database, after the Phase 2 work. Everything passed; the numbers below come from that run.

| Check | Command | Result |
|---|---|---|
| Backend lint and format | `ruff check .` and `ruff format --check .` | clean (310 files) |
| Migrations up and down | `make test-migrations` | 2 passed |
| Backend tests, real PostgreSQL | `pytest --database` | 533 passed |
| Frontend lint and types | `eslint .` and `next typegen && tsc --noEmit` (the two steps of `pnpm check`) | clean |
| Frontend unit tests | `pnpm test` | 329 passed |
| Frontend production build | `next build` | compiles, every route generated |
| Browser tests (desktop, tablet, mobile) | `playwright test` | 213 tests: 212 passed and 1 flaky (a mobile support test that fails its first attempt now and then and passes on the automatic retry), none failed; the layout spec runs on desktop only |

Not part of this gate: CI, deployment, load testing, real-device checks and the live Clerk run (see Known limitations).

## Browser tests (Phase 17)

Playwright runs the real web app against the real API and a known database. No Clerk account or password is needed: a test-only gateway signs a token for the demo person each test chooses, and the API still verifies it (the sign-in bypass works only when `E2E_AUTH=1` outside production).

1. Create a disposable PostgreSQL database in the test container and export its address. From `backend/`: `.venv/bin/python ../frontend/e2e/support/database.py create`, then `export E2E_DATABASE_URL=$(.venv/bin/python ../frontend/e2e/support/database.py url)` (it reads the passwords in the root `.env`; never print the address). `drop` removes it afterwards.
2. From `frontend/`: `node_modules/.bin/playwright test` (or `pnpm e2e`). It migrates and seeds the database (`app.seed_demo` plus `app.seed_e2e`, both repeatable), starts the API and the signing proxy, starts the web app, and uses the Chrome installed on the machine. Projects: desktop (1280 px), tablet (iPad) and mobile (Pixel 7); the layout spec runs on desktop only because it sets its own sizes.
3. Layout is checked at 320 (small phone), 390 (phone), 768 (tablet), 1024 (tablet landscape) and 1280 (desktop) pixels wide: no sideways scrolling, and controls at least 24 px (WCAG 2.5.8; most are 44 px) at phone and tablet widths.
4. The demo people and what each can do are listed in `frontend/e2e/identities.ts`; `e2e/specs/foundation.spec.ts` checks that each one is who the table says and that the known data and the refusals are as expected.

## Core scope acceptance (Phase 1)

Each criterion from section 11 of the project scope, with the evidence for it. "Browser" means a Playwright test in `frontend/e2e/specs/`; backend files are in `backend/tests/`.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A reviewer can sign in with documented demo accounts for each supported role | Partly met | The seeds create the demo people (`app.seed_demo`, `app.seed_e2e`) and the API verifies Clerk tokens, but no passwords exist: a reviewer must create matching users in a Clerk development instance (steps under Demo accounts and Try it with a real Clerk instance). Browser tests use a signed test token instead (`e2e/identities.ts`). |
| 2 | Estimate, request, compare, accept, track | Met | Browser: `customer-acceptance.spec.ts` (estimate, request, offer, accept, tracking). API: `test_core_journey.py`. Saving an estimate from the page itself needs a real Clerk session and is covered through the API. |
| 3 | Company A cannot reach Company B's enquiries, quotations, notes or files | Met | Browser: `company-quotation.spec.ts`, `notifications-documents.spec.ts` (403 for other companies and technicians). API: `test_company_access.py`, `test_core_journey.py`. |
| 4 | Customers cannot read other customers' records by changing an id | Met | Browser: `foundation.spec.ts`, `notifications-documents.spec.ts` (404). API: `test_saved_estimate_access.py`, `test_request_reads.py`. |
| 5 | Catalogue filters and comparisons show consistent units and missing values | Met | Unit tests: `lib/catalogue/detail.test.ts`, `lib/comparison/table.test.ts`. API: `test_catalogue_public.py`, `test_comparison_favourites.py`. |
| 6 | Saved estimates keep the assumptions used | Met | `test_saved_estimate_snapshot.py`, `test_saved_estimate_history.py`, `test_estimator_config_admin.py` (published versions are immutable). |
| 7 | Quotation totals are calculated and validated by the backend | Met | `test_quotation_terms.py`, `test_quotation_edit_contract.py`; the browser form sends no totals (`company-quotation.spec.ts` reads the server's). |
| 8 | Sent revisions stay accessible and unchanged | Met | Database immutability in `test_migrations.py` and migration 0029; `test_quotation_current_read.py`; browser: the sent page offers no inputs (`company-quotation.spec.ts`). |
| 9 | Expired or superseded offers cannot be accepted | Met | `test_quotation_acceptance_policy.py`, `test_quotation_acceptance_transaction.py`; the screens explain refusals from fresh state (unit tests `lib/quotation/decision.test.ts`). |
| 10 | Concurrent acceptance cannot create two accepted offers for one request | Met | `test_quotation_acceptance_transaction.py::test_competing_acceptance_has_one_committed_winner` (real PostgreSQL); browser: the competing-offer test in `customer-acceptance.spec.ts`. |
| 11 | Implemented scheduling rejects conflicting technician visits | Met (Phase 2) | A database exclusion constraint rejects overlapping confirmed visits for one technician even for direct writes (`test_site_visit_*`), and the browser spec `site-visits.spec.ts` shows the conflict explained from fresh state. |
| 12 | Invalid installation transitions are rejected with understandable errors | Met | API: `test_core_journey.py` (order and evidence rules), `test_quotation_states.py`; screens: `lib/installations/staff.test.ts` and the explanations from fresh state. |
| 13 | Private attachments require authorisation | Met | `test_private_media_routes.py`, `test_core_journey.py` (evidence), browser: `notifications-documents.spec.ts` (everyone else refused, signed out 401). |
| 14 | Critical workflows pass automated tests | Met | Backend suite (533 tests with `--database`), 329 frontend unit tests, 213 browser tests (see Local release gate). |
| 15 | Works on desktop and mobile browser sizes | Met | Browser: `layout.spec.ts` (320 to 1280 px) and `accessibility.spec.ts` (axe, WCAG 2.2 AA). Emulated, not real devices. |
| 16 | Sample identities, prices and estimates are labelled | Met | Fictional names end in "(Fictional)" (`test_demo_seed.py`); prices carry "Sample price" and claims "Company declared, not verified"; the home page states the demonstration status; estimates say they are planning aids. |

## Phase 2 acceptance (Phases 18 and 19)

Phase 2 adds to the core release without changing it. "Browser" means a Playwright test in `frontend/e2e/specs/`; backend files are in `backend/tests/`.

| Feature | Status | Evidence |
|---|---|---|
| Technician workspace, conflict-checked site visits, visit evidence | Met | Browser: `site-visits.spec.ts`; API: `test_site_visit_*`, database exclusion constraint for overlapping confirmed visits. |
| Sourced troubleshooting references with hazard escalation | Met for one model | `test_troubleshooting*`, browser `support.spec.ts`. The three seeded references for `GW3000-DNS-30` come from GoodWe's DNS G3 user manual (V1.5-2023-05-25, a distributor-hosted copy) and cite its pages; no other model has any, and the earth fault hazard rating is a cautious choice that a qualified person should confirm. |
| Support cases with private attachments, assignment and replay-safe updates | Met | `test_support_*`, browser `support.spec.ts`. |
| Education articles with review, sources and time-sensitive notices | Met; three of seven articles verified | `test_education*`, `test_education_sources.py`, browser `education.spec.ts`. Three articles were read against their cited regulator and Department of Energy pages and are not labelled sample; four stay marked as sample. No human reviewer has signed any of them off. |
| Quotation PDF export of an exact revision, built in the background and delivered privately | Met | `test_quotation_pdf.py` (PDF read back and compared with the stored revision), `test_quotation_exports.py`, browser `phase2-workflows.spec.ts` (the customer's Prepare and Download PDF buttons and the company's download), `test_quotation_pdf_access.py` (who may fetch each PDF route). Local private storage only. Export files are named after their export and old ones are removed by a daily job (`python -m app.jobs.cleanup_exports`, also scheduled in Inngest at 03:00): ready exports after 30 days (the customer can ask again) and files a crashed attempt left behind. |
| Transactional email with a local sink | Met | `test_mail.py`, `test_email_delivery.py` (one email per notification, retry-safe, switchable per person), `test_smtp_delivery.py` (delivery to a real SMTP server over a local socket), browser `phase2-workflows.spec.ts`. Not tried against a hosted provider or a real inbox. |
| Private notification settings | Met | `test_notification_preferences.py` (defaults, privacy, reminders and email actually stopped), browser `phase2-workflows.spec.ts`. Only two switches exist: reminders and email. |
| Password and account recovery | Met by Clerk in the code; live flow not yet run | `frontend/src/lib/recovery.test.ts` guards against a custom reset system. An opt-in live check against a real Clerk development instance is written (`playwright.live.config.ts`); only its sign-in page test has been run. |
| Pending-offer, visit and yearly maintenance reminders | Met in the API; scheduled hourly through Inngest | `test_reminders.py`, `test_reminder_schedule.py`, browser `phase2-workflows.spec.ts`. Visit reminders say the start time in the visit's own time zone and wait for daytime there (07:00 to 21:00) unless the visit is within 3 hours. Not tried against a running Inngest server. |
| Net accounting and net plus estimator scenarios | Met | `test_estimator_export_scenarios.py`, `test_e2e_seed.py`, browser `phase2-workflows.spec.ts` (the estimate form, the administrator's draft and saved estimates). The feed-in rate follows the PUCSL August 2026 decision (see Estimator scenarios); it must be rechecked. |

Still deferred: net plus plus, off-grid, hybrid and battery estimates; email links and per-event switches; production file storage; a live Clerk sign-in and recovery run; human review of the content; and everything in Phase 3 and the deployment phase.
