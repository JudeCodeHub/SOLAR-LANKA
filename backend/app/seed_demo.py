"""Insert-only fictional fixtures. Run: .venv/bin/python -m app.seed_demo

Requires migrated development PostgreSQL. Never changes existing account roles,
suspensions or company edits. Synthetic demo subjects are not Clerk credentials;
no password, token or sign-in bypass is created. Tests alone override identity.
"""

from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.company import Company, CompanyMembership
from app.models.user import AppUser
from app.seed_catalogue import seed_catalogue

DEMO_COMPANIES = (
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000001"), "Demo Sunbird Solar (Fictional)"),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000002"), "Demo Moonleaf Energy (Fictional)"),
)
DEMO_USERS = (
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000011"), "demo_seed_company_a"),
    (UUID("f7b6a8b0-4091-42b0-9d36-000000000012"), "demo_seed_company_b"),
)


def seed_demo(session: Session, *, environment: str) -> None:
    if environment not in {"development", "test"}:
        raise ValueError("Demo seeds are allowed only in development or test")
    for user_id, subject in DEMO_USERS:
        session.execute(
            insert(AppUser)
            .values(id=user_id, clerk_subject=subject, role="customer")
            .on_conflict_do_nothing(index_elements=[AppUser.id])
        )
    for company_id, name in DEMO_COMPANIES:
        session.execute(
            insert(Company)
            .values(id=company_id, name=name, publication_status="draft")
            .on_conflict_do_nothing(index_elements=[Company.id])
        )
    for (user_id, _), (company_id, _) in zip(DEMO_USERS, DEMO_COMPANIES, strict=True):
        session.execute(
            insert(CompanyMembership)
            .values(user_id=user_id, company_id=company_id, role="company_admin", status="active")
            .on_conflict_do_nothing(constraint="uq_company_memberships_user_company")
        )

    seed_catalogue(
        session,
        environment=environment,
        company_ids=tuple(company_id for company_id, _ in DEMO_COMPANIES),
    )


def main() -> None:
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("Demo seed CLI requires development mode")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            seed_demo(session, environment=settings.environment)
            session.commit()
        print("Demo fixtures ready; existing records preserved. No login credentials created.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
