"""Extra fictional identities for browser tests, added to the demo fixtures; safe to repeat."""

from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.company import CompanyMembership
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, seed_demo

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
)


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
