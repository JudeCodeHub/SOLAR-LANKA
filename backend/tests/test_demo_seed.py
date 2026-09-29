"""Repeatable fictional fixtures and real company route isolation."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.audit import AuditEvent
from app.models.company import Company, CompanyMembership, CompanyReview
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
from app.models.user import AppUser
from app.seed_catalogue import GOODWE_DNS, INVERTERS, PANELS, TRINA_RC
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo


@pytest.mark.database
def test_seed_repeatability_and_company_isolation(
    database_client, database_connection, database_session
):
    schema = f"seed_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser,
        Company,
        CompanyMembership,
        CompanyReview,
        AuditEvent,
        Product,
        Panel,
        Inverter,
        ProductSource,
        ProductOffer,
        EstimatorConfigVersion,
        SavedEstimate,
        QuotationRequest,
        RequestDelivery,
        Quotation,
        QuotationRevision,
        Installation,
        InstallationMilestoneRecord,
    ):
        model.__table__.create(database_connection)
    for _ in range(2):
        seed_demo(database_session, environment="test")
        database_session.commit()
    for model, expected in ((AppUser, 3), (Company, 2), (CompanyMembership, 2)):
        assert database_session.scalar(select(func.count()).select_from(model)) == expected
    assert len(PANELS) == len(INVERTERS) == 10
    for model, expected in (
        (Product, 20),
        (Panel, 10),
        (Inverter, 10),
        (ProductSource, 20),
        (ProductOffer, 20),
        (QuotationRequest, 4),
        (RequestDelivery, 4),
        (Quotation, 4),
        (QuotationRevision, 5),
        (Installation, 1),
        (InstallationMilestoneRecord, 8),
    ):
        assert database_session.scalar(select(func.count()).select_from(model)) == expected
    assert all(
        p.is_demo_price and p.currency == "LKR" and p.claim_label == "company_declared"
        for p in database_session.scalars(select(ProductOffer))
    )
    assert all(
        source.verified_at is not None and source.source_url.startswith("https://")
        for source in database_session.scalars(select(ProductSource))
    )
    assert database_session.scalars(select(Panel)).first().product_warranty_years is None
    assert database_session.scalars(select(Inverter)).first().compatibility_notes is None
    assert TRINA_RC.startswith("https://static.trinasolar.com/")
    assert GOODWE_DNS.startswith("https://en.goodwe.com/")
    statuses = {row.status for row in database_session.scalars(select(QuotationRevision))}
    assert statuses == {"draft", "revised", "sent", "expired", "accepted"}
    installation = database_session.scalars(select(Installation)).one()
    assert installation.accepted_revision_id == demo_id("accepted", "revision", "1")
    assert database_session.get(AppUser, DEMO_CUSTOMER[0]).role == "customer"
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
    seeded_product = database_session.scalars(
        select(Product).where(Product.kind == "panel")
    ).first()
    seeded_offer = database_session.scalars(
        select(ProductOffer).where(ProductOffer.product_id == seeded_product.id)
    ).one()
    seeded_product.model = "Edited demo model"
    seeded_offer.indicative_price = 123
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
    assert seeded_product.model == "Edited demo model"
    assert seeded_offer.indicative_price == 123


def test_production_seeding_is_rejected():
    with pytest.raises(ValueError, match="development or test"):
        seed_demo(None, environment="production")
