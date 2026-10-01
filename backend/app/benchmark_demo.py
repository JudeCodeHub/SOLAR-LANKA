"""Time common read endpoints against the demo seed. Run: .venv/bin/python -m app.benchmark_demo

Requires a migrated, seeded development PostgreSQL (see app.seed_demo). Point
SOLAR_DATABASE_URL at a disposable database to avoid touching real development data.
Requests run in-process through the real application with the verified identity
replaced, so timings exclude network and Clerk verification. They describe this tiny
demo dataset only and say nothing about production capacity.

Each statement a request issues is also re-planned with sequential scans disabled. A
table that still needs a sequential scan then has no usable index for that filter.
"""

import statistics
import time
from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import event

from app.core.auth import VerifiedIdentity, require_identity
from app.core.database_config import DatabaseSettings
from app.main import create_app
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id

RUNS = 30
WARMUPS = 3
CUSTOMER = DEMO_CUSTOMER[1]
COMPANY_A, COMPANY_B, *_ = (company_id for company_id, _ in DEMO_COMPANIES)
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)


def scenarios() -> list[tuple[str, str, str]]:
    """(label, identity subject, path); public routes use the customer identity harmlessly."""
    request = lambda name: str(demo_id(name, "request"))  # noqa: E731
    delivery = lambda name: str(demo_id(name, "delivery"))  # noqa: E731
    quotation = lambda name: str(demo_id(name, "quotation"))  # noqa: E731
    return [
        ("catalogue panels list", CUSTOMER, "/catalogue/panels"),
        ("catalogue panels search", CUSTOMER, "/catalogue/panels?search=solar"),
        ("catalogue inverters list", CUSTOMER, "/catalogue/inverters"),
        ("public companies list", CUSTOMER, "/public/companies"),
        ("customer requests list", CUSTOMER, "/users/me/requests"),
        (
            "customer request detail",
            CUSTOMER,
            f"/users/me/requests/{request('revised')}",
        ),
        (
            "offer comparison",
            CUSTOMER,
            f"/users/me/requests/{request('revised')}/quotations/compare",
        ),
        (
            "customer installation",
            CUSTOMER,
            f"/users/me/installations/{demo_id('accepted', 'installation')}",
        ),
        ("notifications list", CUSTOMER, "/users/me/notifications"),
        ("favourites list", CUSTOMER, "/users/me/favourites"),
        ("company inbox", STAFF_A, f"/companies/{COMPANY_A}/request-deliveries"),
        (
            "company revision history",
            STAFF_A,
            f"/companies/{COMPANY_A}/request-deliveries/{delivery('revised')}"
            f"/quotations/{quotation('revised')}/revisions",
        ),
        ("company offers", STAFF_B, f"/companies/{COMPANY_B}/offers"),
    ]


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(fraction * (len(ordered) - 1)))]


def explain_without_seq_scans(engine, captured: list[tuple[str, object]]) -> set[str]:
    """Return relations that still need a sequential scan when indexes are preferred."""
    leftover: set[str] = set()
    with engine.connect() as connection:
        connection.exec_driver_sql("SET enable_seqscan = off")
        for statement, parameters in captured:
            if not statement.lstrip().upper().startswith("SELECT"):
                continue
            plan = connection.exec_driver_sql("EXPLAIN (FORMAT JSON) " + statement, parameters)
            stack = list(plan.scalar_one())
            while stack:
                node = stack.pop()
                node = node.get("Plan", node)
                if node.get("Node Type") == "Seq Scan":
                    leftover.add(node["Relation Name"])
                stack.extend(node.get("Plans", []))
    return leftover


def main() -> None:
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("Benchmark requires development mode")
    subject = {"value": CUSTOMER}
    app = create_app()
    app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject=subject["value"], session_id="benchmark"
    )
    rows = []
    with TestClient(app) as client:
        engine = app.state.database_engine
        captured: list[tuple[str, object]] = []

        def record(conn, cursor, statement, parameters, context, executemany):
            captured.append((statement, parameters))

        event.listen(engine, "before_cursor_execute", record)
        for label, who, path in scenarios():
            subject["value"] = who
            get: Callable = lambda path=path: client.get(path)  # noqa: E731
            for _ in range(WARMUPS):
                get()
            captured.clear()
            status = get().status_code
            statements = len(captured)
            sequential = explain_without_seq_scans(engine, list(captured))
            timings = []
            for _ in range(RUNS):
                start = time.perf_counter()
                get()
                timings.append((time.perf_counter() - start) * 1000)
            rows.append(
                (
                    label,
                    status,
                    statements,
                    statistics.median(timings),
                    percentile(timings, 0.95),
                    ", ".join(sorted(sequential)) or "-",
                )
            )
        event.remove(engine, "before_cursor_execute", record)
    print(f"{'endpoint':28} {'HTTP':>4} {'SQL':>3} {'p50 ms':>7} {'p95 ms':>7}  needs seq scan")
    for label, status, statements, p50, p95, sequential in rows:
        print(f"{label:28} {status:>4} {statements:>3} {p50:7.1f} {p95:7.1f}  {sequential}")
    print(f"\n{RUNS} timed runs after {WARMUPS} warm-ups, in-process, demo dataset only.")


if __name__ == "__main__":
    main()
