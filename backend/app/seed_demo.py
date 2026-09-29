"""Insert-only fictional fixtures. Run: .venv/bin/python -m app.seed_demo

Requires migrated development PostgreSQL. Never changes existing account roles,
suspensions or company edits. Synthetic demo subjects are not Clerk credentials;
no password, token or sign-in bypass is created. Tests alone override identity.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.core.installation_milestones import SEQUENCE
from app.db.session import create_database_engine
from app.models.company import Company, CompanyMembership
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
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


DEMO_CUSTOMER = (UUID("f7b6a8b0-4091-42b0-9d36-000000000013"), "demo_seed_customer")


def demo_id(*parts: str) -> UUID:
    return uuid5(NAMESPACE_URL, "solarlanka:demo-workflow:" + ":".join(parts))


def seed_workflow(session: Session) -> None:
    """Insert fixed fictional scenarios; preserve edits to existing fixtures."""
    customer_id, _ = DEMO_CUSTOMER
    sent_at = datetime(2026, 1, 1, tzinfo=UTC)
    expired_at = datetime(2026, 1, 31, tzinfo=UTC)
    current_sent_at = datetime(2029, 12, 1, tzinfo=UTC)
    future_at = datetime(2030, 1, 1, tzinfo=UTC)
    scenarios = (
        ("pending", DEMO_COMPANIES[0][0], ((1, "draft"),)),
        ("revised", DEMO_COMPANIES[0][0], ((1, "revised"), (2, "sent"))),
        ("expired", DEMO_COMPANIES[1][0], ((1, "expired"),)),
        ("accepted", DEMO_COMPANIES[1][0], ((1, "accepted"),)),
    )
    for name, company_id, revisions in scenarios:
        request_id = demo_id(name, "request")
        delivery_id = demo_id(name, "delivery")
        quotation_id = demo_id(name, "quotation")
        session.execute(
            insert(QuotationRequest)
            .values(
                id=request_id,
                customer_id=customer_id,
                requirements={"demo_scenario": name, "note": "Fictional demonstration only"},
            )
            .on_conflict_do_nothing(index_elements=[QuotationRequest.id])
        )
        session.execute(
            insert(RequestDelivery)
            .values(
                id=delivery_id,
                request_id=request_id,
                company_id=company_id,
            )
            .on_conflict_do_nothing(index_elements=[RequestDelivery.id])
        )
        session.execute(
            insert(Quotation)
            .values(id=quotation_id, delivery_id=delivery_id)
            .on_conflict_do_nothing(index_elements=[Quotation.id])
        )
        for number, status in revisions:
            revision_id = demo_id(name, "revision", str(number))
            is_sent = status != "draft"
            session.execute(
                insert(QuotationRevision)
                .values(
                    id=revision_id,
                    quotation_id=quotation_id,
                    request_id=request_id,
                    revision_number=number,
                    status=status,
                    currency="LKR",
                    capacity_kwp=Decimal("3.000"),
                    warranty_terms="Fictional demonstration warranty",
                    exclusions="Site-specific charges excluded",
                    validity_days=30,
                    subtotal=Decimal("500000.00"),
                    discount=Decimal("0.00"),
                    tax=Decimal("0.00"),
                    total=Decimal("500000.00"),
                    sent_at=(current_sent_at if status in {"accepted", "sent"} else sent_at)
                    if is_sent
                    else None,
                    valid_until=(future_at if status in {"accepted", "sent"} else expired_at)
                    if is_sent
                    else None,
                )
                .on_conflict_do_nothing(index_elements=[QuotationRevision.id])
            )
        if name == "accepted":
            installation_id = demo_id(name, "installation")
            session.execute(
                insert(Installation)
                .values(id=installation_id, accepted_revision_id=demo_id(name, "revision", "1"))
                .on_conflict_do_nothing(index_elements=[Installation.id])
            )
            for position, kind in enumerate(SEQUENCE, start=1):
                session.execute(
                    insert(InstallationMilestoneRecord)
                    .values(
                        id=demo_id(name, "milestone", str(position)),
                        installation_id=installation_id,
                        position=position,
                        kind=kind.value,
                        status="in_progress" if position == 1 else "pending",
                        evidence_refs=[],
                    )
                    .on_conflict_do_nothing(index_elements=[InstallationMilestoneRecord.id])
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
    session.execute(
        insert(AppUser)
        .values(id=DEMO_CUSTOMER[0], clerk_subject=DEMO_CUSTOMER[1], role="customer")
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

    seed_workflow(session)

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
