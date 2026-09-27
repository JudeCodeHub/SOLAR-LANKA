"""Repeatable fictional fixtures and real company route isolation."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.audit import AuditEvent
from app.models.company import Company, CompanyMembership, CompanyReview
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_USERS, seed_demo


@pytest.mark.database
def test_seed_repeatability_and_company_isolation(
    database_client, database_connection, database_session
):
    schema = f"seed_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (AppUser, Company, CompanyMembership, CompanyReview, AuditEvent):
        model.__table__.create(database_connection)
    for _ in range(2):
        seed_demo(database_session, environment="test")
        database_session.commit()
    for model in (AppUser, Company, CompanyMembership):
        assert database_session.scalar(select(func.count()).select_from(model)) == 2
    database_session.commit()
    for index in (0, 1):
        subject = DEMO_USERS[index][1]
        own, foreign = DEMO_COMPANIES[index][0], DEMO_COMPANIES[1 - index][0]
        database_client.app.dependency_overrides[require_identity] = lambda subject=subject: (
            VerifiedIdentity(subject, "test_session")
        )
        assert database_client.get(f"/companies/{own}").status_code == 200
        assert database_client.get(f"/companies/{foreign}").status_code == 403
        assert (
            database_client.patch(f"/companies/{foreign}", json={"name": "Intrusion"}).status_code
            == 403
        )
        assert database_client.get(f"/companies/{foreign}/reviews").status_code == 403
        assert (
            database_client.post(
                f"/companies/{foreign}/memberships",
                json={"user_id": str(DEMO_USERS[index][0]), "role": "company_admin"},
            ).status_code
            == 403
        )
    user = database_session.get(AppUser, DEMO_USERS[0][0])
    user.is_suspended = True
    company = database_session.get(Company, DEMO_COMPANIES[0][0])
    company.name = "Edited demo company"
    membership = database_session.scalars(
        select(CompanyMembership).where(CompanyMembership.user_id == user.id)
    ).one()
    membership.status = "suspended"
    database_session.commit()
    seed_demo(database_session, environment="test")
    database_session.commit()
    database_session.expire_all()
    assert user.is_suspended
    assert company.name == "Edited demo company"
    assert membership.status == "suspended"


def test_production_seeding_is_rejected():
    with pytest.raises(ValueError, match="development or test"):
        seed_demo(None, environment="production")
