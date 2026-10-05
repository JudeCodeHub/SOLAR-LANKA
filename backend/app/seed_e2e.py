"""Extra fictional identities for browser tests, added to the demo fixtures; safe to repeat."""
# ruff: noqa: E501 -- readable reference text is kept on long lines

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.core.estimator_scenario import GRID_NET_ACCOUNTING, GRID_NET_METERING, GRID_NET_PLUS
from app.db.session import create_database_engine
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.product import Product
from app.models.troubleshooting import TroubleshootingReference
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, seed_demo
from app.seed_education import seed_education

SUNBIRD = DEMO_COMPANIES[0][0]

# (user id, Clerk subject, account role, company membership role at Sunbird or None)
E2E_IDENTITIES: tuple[tuple[UUID, str, str, str | None], ...] = (
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000021"), "e2e_platform_admin", "platform_admin", None),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000022"), "e2e_customer_two", "customer", None),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000023"), "e2e_customer_new", "customer", None),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000024"), "e2e_sunbird_sales", "customer", "sales"),
    (
        UUID("f7b6a8b0-4091-42b0-9d36-000000000025"),
        "e2e_sunbird_technician",
        "customer",
        "technician",
    ),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000026"), "e2e_customer_estimate", "customer", None),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000028"), "e2e_content_reviewer", "platform_admin", None),
)

# A second company serving the same district as the first, so offers can compete.
RIVAL_COMPANY = (UUID("f7b6a8b0-4091-42b0-9d36-000000000031"), "E2E Rival Solar (Fictional)")
RIVAL_ADMIN = (UUID("f7b6a8b0-4091-42b0-9d36-000000000027"), "e2e_rival_admin")

_SOURCE = {
    "publisher": "Fictional demonstration source",
    "title": "Fictional planning assumption",
    "unit": "per the assumption",
    "reviewed_on": "2026-09-28",
    "effective_from": "2026-09-28",
    "limitation": "Fictional values for demonstration only.",
}
# A complete, fictional estimator version so the estimator works on a freshly seeded database.
E2E_ASSUMPTIONS = {
    "panel_wattage_w": "500",
    "panel_area_m2": "2.5",
    "annual_yield_kwh_per_kwp": {"low": "1500", "high": "1500"},
    "shading_factors": {
        "none": {"low": "1.0", "high": "1.0"},
        "partial": {"low": "0.8", "high": "0.8"},
        "heavy": {"low": "0.5", "high": "0.5"},
    },
    "installed_cost_lkr_per_kwp": {"low": "100000", "high": "120000"},
    "fixed_installation_cost_lkr": {"low": "0", "high": "0"},
    "domestic_tariff": {
        "regimes": [
            {
                "from_kwh": "0",
                "through_kwh": "60",
                "blocks": [
                    {"through_kwh": "30", "rate_lkr_per_kwh": "5"},
                    {"through_kwh": "60", "rate_lkr_per_kwh": "9"},
                ],
                "fixed_charge_lkr": "80",
            },
            {
                "from_kwh": "60",
                "through_kwh": None,
                "blocks": [
                    {"through_kwh": "60", "rate_lkr_per_kwh": "10"},
                    {"through_kwh": None, "rate_lkr_per_kwh": "20"},
                ],
                "fixed_charge_lkr": "100",
            },
        ],
        "other_monthly_charge_lkr": "0",
        "tax_percent": "0",
    },
}
E2E_SOURCES = {
    "yield": {**_SOURCE, "url": "https://example.org/fictional-yield"},
    "tariff": {**_SOURCE, "url": "https://example.org/fictional-tariff"},
    "cost": {**_SOURCE, "url": "https://example.org/fictional-quote", "basis": "installer_quote"},
}


def seed_e2e(session: Session, *, environment: str) -> None:
    """Demo fixtures plus the people browser tests sign in as; existing records are kept."""
    if environment not in {"development", "test"}:
        raise ValueError("E2E identities are allowed only in development or test")
    seed_demo(session, environment=environment)
    for user_id, subject, role, membership in E2E_IDENTITIES:
        session.execute(
            insert(AppUser)
            .values(id=user_id, clerk_subject=subject, role=role)
            .on_conflict_do_nothing(index_elements=[AppUser.id])
        )
        if membership is not None:
            session.execute(
                insert(CompanyMembership)
                .values(user_id=user_id, company_id=SUNBIRD, role=membership, status="active")
                .on_conflict_do_nothing(constraint="uq_company_memberships_user_company")
            )
    seed_estimator(session)
    session.flush()
    seed_troubleshooting(session)
    seed_education(session)
    session.execute(
        insert(Company)
        .values(
            id=RIVAL_COMPANY[0],
            name=RIVAL_COMPANY[1],
            publication_status="approved",
            service_districts=["Colombo"],
            services=["installation"],
            declared_credentials=[],
        )
        .on_conflict_do_nothing(index_elements=[Company.id])
    )
    session.execute(
        insert(AppUser)
        .values(id=RIVAL_ADMIN[0], clerk_subject=RIVAL_ADMIN[1], role="customer")
        .on_conflict_do_nothing(index_elements=[AppUser.id])
    )
    session.execute(
        insert(CompanyMembership)
        .values(
            user_id=RIVAL_ADMIN[0],
            company_id=RIVAL_COMPANY[0],
            role="company_admin",
            status="active",
        )
        .on_conflict_do_nothing(constraint="uq_company_memberships_user_company")
    )


# Fictional feed-in rate for the two export scenarios; the real figure is dated and sourced.
E2E_EXPORT_ASSUMPTIONS = {**E2E_ASSUMPTIONS, "export_rate_lkr_per_kwh": {"low": "25", "high": "25"}}
E2E_EXPORT_SOURCES = {
    **E2E_SOURCES,
    "export": {**_SOURCE, "url": "https://example.org/fictional-export"},
}


def seed_estimator(session: Session) -> None:
    """Publish a fictional version of each supported scenario that has none."""
    scenarios = (
        (GRID_NET_METERING, E2E_ASSUMPTIONS, E2E_SOURCES),
        (GRID_NET_ACCOUNTING, E2E_EXPORT_ASSUMPTIONS, E2E_EXPORT_SOURCES),
        (GRID_NET_PLUS, E2E_EXPORT_ASSUMPTIONS, E2E_EXPORT_SOURCES),
    )
    for scenario, assumptions, sources in scenarios:
        existing = session.scalar(
            select(EstimatorConfigVersion.id)
            .where(EstimatorConfigVersion.scenario == scenario.identifier)
            .limit(1)
        )
        if existing is None:
            session.add(
                EstimatorConfigVersion(
                    scenario=scenario.identifier,
                    version=1,
                    status="published",
                    assumptions=assumptions,
                    source_metadata=sources,
                    published_at=datetime.now(UTC),
                )
            )


MANUAL_TITLE = "GoodWe Grid-Tied PV Inverter DNS Series (3.0-6.0kW) G3 User Manual, V1.5-2023-05-25"
# A distributor-hosted copy of the manufacturer's manual; its model list includes GW3000-DNS-30.
MANUAL_URL = "https://www.sparkydirect.com.au/assets/files/GW5000-DNS-30_Manual.pdf"
MANUAL_CHECKED = datetime(2026, 10, 5, tzinfo=UTC)
# The one model that has references; its sibling GW3600-DNS-30 deliberately has none.
SAMPLE_MODEL = "GW3000-DNS-30"


def manual_source(page: str) -> dict:
    """Every reference below was read against the manual page it cites."""
    return {
        "source_title": MANUAL_TITLE,
        "source_url": MANUAL_URL,
        "source_page": page,
        "verified_on": MANUAL_CHECKED,
        "is_sample": False,
        "status": "published",
    }


def seed_troubleshooting(session: Session) -> None:
    """Three references on one exact model taken from its manual, only when it has none."""
    product = session.scalars(select(Product).where(Product.model == SAMPLE_MODEL)).first()
    admin = session.scalars(
        select(AppUser).where(AppUser.clerk_subject == "e2e_platform_admin")
    ).first()
    if product is None or admin is None:
        return
    exists = session.scalar(
        select(TroubleshootingReference.id).where(TroubleshootingReference.product_id == product.id)
    )
    if exists is not None:
        return
    session.add_all(
        [
            TroubleshootingReference(
                product_id=product.id,
                code="Utility Loss",
                title="Display shows Utility Loss",
                steps=[
                    "Write down the fault name and the time it appeared.",
                    "Check whether the rest of your home has power: the manual lists the utility grid failing as a cause.",
                    "The manual says the alarm clears by itself once the grid power supply is restored, so wait for that.",
                    "If it does not clear, tell your installer. The manual's other cause is a disconnected AC cable or a switched-off AC breaker.",
                ],
                safety_level="safe_observation",
                created_by=admin.id,
                **manual_source("35"),
            ),
            TroubleshootingReference(
                product_id=product.id,
                code="Grid Overvoltage",
                title="Display shows Grid Overvoltage",
                steps=[
                    "Write down the fault name, the time and how often it happens.",
                    "If it happens only occasionally, the manual says the grid may be temporarily abnormal and the inverter recovers by itself once the grid is normal.",
                    "If it keeps happening, tell your installer. The manual's checks involve the grid voltage and the local power company, and changing settings needs the power company's consent, so do not change settings yourself.",
                ],
                safety_level="safe_observation",
                created_by=admin.id,
                **manual_source("35"),
            ),
            TroubleshootingReference(
                product_id=product.id,
                code="Low Insulation Res. (Earth fault alarm)",
                title="Display shows an earth fault alarm",
                steps=[
                    "Write down the fault name and the time it appeared.",
                    "Take a photo of the display or the app from a safe distance.",
                    "Keep children and others away from the inverter, and tell your installer or the manufacturer's after-sales service.",
                ],
                safety_level="hazard",
                hazard_warning=(
                    "Do not touch it. The manual marks this equipment as a high voltage hazard with "
                    "delayed discharge and a hot surface while it operates, and says it must be "
                    "powered off, with a 5 minute wait, before anyone works on it. Only a qualified "
                    "technician should check the cause: call a qualified technician."
                ),
                created_by=admin.id,
                **manual_source("38, with the safety notices on pages 4 and 34"),
            ),
        ]
    )


def main() -> None:
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("The E2E seed requires development mode")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            seed_e2e(session, environment=settings.environment)
            session.commit()
        print("Demo fixtures and E2E identities ready; no login credentials created.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
