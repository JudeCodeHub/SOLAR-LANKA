"""Extra fictional identities for browser tests, added to the demo fixtures; safe to repeat."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.core.estimator_scenario import GRID_NET_METERING
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


def seed_estimator(session: Session) -> None:
    """Publish a fictional estimator version only when the database has none."""
    scenario = GRID_NET_METERING.identifier
    existing = session.scalar(
        select(EstimatorConfigVersion.id)
        .where(EstimatorConfigVersion.scenario == scenario)
        .limit(1)
    )
    if existing is None:
        session.add(
            EstimatorConfigVersion(
                scenario=scenario,
                version=1,
                status="published",
                assumptions=E2E_ASSUMPTIONS,
                source_metadata=E2E_SOURCES,
                published_at=datetime.now(UTC),
            )
        )


SAMPLE_SOURCE = {
    "source_title": "Fictional demonstration reference (not a manufacturer document)",
    "source_url": "https://example.org/fictional-troubleshooting",
    "source_page": "1",
    "verified_on": datetime(2026, 9, 28, tzinfo=UTC),
    "is_sample": True,
    "status": "published",
}
# The seeded inverter that has references; its sibling GW3600-DNS-30 deliberately has none.
SAMPLE_MODEL = "GW3000-DNS-30"


def seed_troubleshooting(session: Session) -> None:
    """Two fictional references on one exact model, only when that model has none."""
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
                code="E01",
                title="Display shows a grid fault code",
                steps=[
                    "Write down the code and the time it appeared.",
                    "Take a photo of the display from a safe distance.",
                    "Check whether the lights in your home are working normally.",
                    "Do not open the inverter or touch its cables.",
                ],
                safety_level="safe_observation",
                created_by=admin.id,
                **SAMPLE_SOURCE,
            ),
            TroubleshootingReference(
                product_id=product.id,
                code="E09",
                title="Burning smell, heat or sparks",
                steps=["Keep everyone away from the inverter and the area around it."],
                safety_level="hazard",
                hazard_warning=(
                    "Do not touch it. Switch off at the main isolator only if you can reach it "
                    "safely, then call a qualified technician or the emergency services."
                ),
                created_by=admin.id,
                **SAMPLE_SOURCE,
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
