"""The browser-test identities are fixed, repeatable and carry exactly the roles documented."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.models.audit import AuditEvent
from app.models.company import Company, CompanyMembership, CompanyReview
from app.models.education import Article, EducationCategory
from app.models.estimator_config import EstimatorConfigVersion
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.product_source import ProductSource
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.troubleshooting import TroubleshootingReference
from app.models.user import AppUser
from app.seed_e2e import E2E_IDENTITIES, RIVAL_COMPANY, SUNBIRD, seed_e2e

TABLES = (
    AppUser, Company, CompanyMembership, CompanyReview, AuditEvent, Product, Panel, Inverter,
    ProductSource, ProductOffer, EstimatorConfigVersion, SavedEstimate, QuotationRequest,
    RequestDelivery, Quotation, QuotationRevision, Installation, InstallationMilestoneRecord,
    TroubleshootingReference, EducationCategory, Article,
)  # fmt: skip


@pytest.mark.database
def test_e2e_identities_are_repeatable_and_have_the_documented_roles(
    database_connection, database_session
) -> None:
    schema = f"e2e_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in TABLES:
        model.__table__.create(database_connection)
    for _ in range(2):
        seed_e2e(database_session, environment="test")
        database_session.commit()
    users = {user.clerk_subject: user for user in database_session.scalars(select(AppUser))}
    for _, subject, role, _ in E2E_IDENTITIES:
        assert users[subject].role == role
    memberships = {
        users_by_id.clerk_subject: member.role
        for member in database_session.scalars(
            select(CompanyMembership).where(CompanyMembership.company_id == SUNBIRD)
        )
        for users_by_id in [database_session.get(AppUser, member.user_id)]
    }
    assert memberships["e2e_sunbird_sales"] == "sales"
    assert memberships["e2e_sunbird_technician"] == "technician"
    assert memberships["demo_seed_company_a"] == "company_admin"
    assert "e2e_platform_admin" not in memberships and "e2e_customer_new" not in memberships
    assert len(users) == 5 + len(E2E_IDENTITIES)
    rival = database_session.get(Company, RIVAL_COMPANY[0])
    assert rival.publication_status == "approved" and rival.service_districts == ["Colombo"]
    refs = list(database_session.scalars(select(TroubleshootingReference)))
    assert sorted(r.code for r in refs) == ["E01", "E09"]
    assert all(r.is_sample and r.status == "published" for r in refs)
    articles = list(database_session.scalars(select(Article)))
    assert len(articles) == 7 and all(a.status == "published" for a in articles)
    # Only the three articles whose claims were read against their sources are not samples.
    assert sorted(a.slug for a in articles if not a.is_sample) == [
        "how-rooftop-solar-works",
        "net-metering-and-other-schemes",
        "understanding-your-electricity-bill",
    ]
    assert all(a.reviewer_id != a.author_id and a.sources for a in articles)
    assert sorted(a.slug for a in articles if a.time_sensitive) == [
        "net-metering-and-other-schemes",
        "understanding-your-electricity-bill",
    ]
    versions = list(database_session.scalars(select(EstimatorConfigVersion)))
    assert sorted((v.scenario, v.version, v.status) for v in versions) == [
        ("grid_net_accounting_no_backup", 1, "published"),
        ("grid_net_metering_no_backup", 1, "published"),
        ("grid_net_plus_no_backup", 1, "published"),
    ]
    with pytest.raises(ValueError):
        seed_e2e(database_session, environment="production")
