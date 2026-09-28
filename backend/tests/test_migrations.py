"""Exercise migration lifecycle on an empty database owned solely by this test."""

from datetime import UTC, datetime, timedelta
from io import StringIO
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError, ProgrammingError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.config import BACKEND_DIR
from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.installation import Installation
from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.product_source import ProductSource
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser


def migration_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


def test_offline_upgrade_generates_sql_without_a_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SOLAR_ENVIRONMENT", "development")
    monkeypatch.setenv(
        "SOLAR_DATABASE_URL", "postgresql://offline:private-password@127.0.0.1:1/offline"
    )
    output = StringIO()
    config = migration_config()
    config.output_buffer = output
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    assert "CREATE TABLE alembic_version" in sql
    assert "0001_initial_baseline" in sql
    assert "trg_quotation_revision_immutable" in sql
    assert "trg_quotation_line_immutable" in sql
    assert "private-password" not in sql


@pytest.mark.database
def test_initial_migration_on_empty_database(database_settings: DatabaseSettings) -> None:
    # Start from the guarded test server, never from development configuration.
    admin_engine = create_database_engine(database_settings)
    temporary_name = f"solarlanka_migration_{uuid4().hex}"
    temporary_engine = None
    created = False
    try:
        with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as admin:
            assert admin.scalar(text("SELECT current_database()")) == "solarlanka_test"
            admin.execute(text(f'CREATE DATABASE "{temporary_name}" TEMPLATE template0'))
            created = True

        temporary_engine = create_engine(
            admin_engine.url.set(database=temporary_name),
            poolclass=NullPool,
            connect_args={"connect_timeout": 5},
        )
        config = migration_config()
        with temporary_engine.begin() as connection:
            assert sorted(inspect(connection).get_table_names()) == []
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            assert MigrationContext.configure(connection).get_current_revision() == (
                "0031_one_winner_per_request"
            )

        with Session(temporary_engine) as session:
            version = EstimatorConfigVersion(
                scenario="grid_net_metering_no_backup",
                version=1,
                assumptions={"monthly_yield_kwh": None},
                source_metadata={"yield": {}, "tariff": {}, "cost": {}},
                status="published",
                published_at=datetime.now(UTC),
            )
            session.add(version)
            session.commit()
            with pytest.raises(ProgrammingError):
                with session.begin_nested():
                    version.assumptions = {"monthly_yield_kwh": 999}
                    session.flush()
            session.expire_all()
            assert session.get(EstimatorConfigVersion, version.id).assumptions == {
                "monthly_yield_kwh": None
            }

        with Session(temporary_engine) as session:
            user = AppUser(clerk_subject="user_verified_test_subject")
            session.add(user)
            session.commit()
            user_id = user.id
            session.expunge_all()
            persisted = session.get(AppUser, user_id)
            assert persisted is not None
            assert persisted.is_suspended is False
            assert persisted.role == "customer"
            assert persisted.clerk_subject == "user_verified_test_subject"
            assert persisted.created_at.utcoffset() is not None
            with pytest.raises(IntegrityError) as duplicate:
                with session.begin_nested():
                    session.add(AppUser(clerk_subject=persisted.clerk_subject))
                    session.flush()
            assert duplicate.value.orig.diag.constraint_name == "uq_app_users_clerk_subject"
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(AppUser(clerk_subject=None))
                    session.flush()

        with Session(temporary_engine) as session:
            company = Company(name="Migration Test Company")
            session.add(company)
            session.flush()
            membership = CompanyMembership(user_id=user_id, company_id=company.id, role="sales")
            session.add(membership)
            session.commit()
            assert company.publication_status == "draft"
            assert membership.status == "active"
            for values in (
                dict(user_id=user_id, company_id=company.id, role="sales"),
                dict(user_id=user_id, company_id=company.id, role="platform_admin"),
                dict(user_id=uuid4(), company_id=company.id, role="sales"),
                dict(user_id=user_id, company_id=uuid4(), role="sales"),
            ):
                with pytest.raises(IntegrityError):
                    with session.begin_nested():
                        session.add(CompanyMembership(**values))
                        session.flush()

        with Session(temporary_engine) as session:
            request = QuotationRequest(
                customer_id=user_id,
                requirements={"district": "Colombo", "details": "Migration quote"},
            )
            session.add(request)
            session.flush()
            delivery = RequestDelivery(request_id=request.id, company_id=company.id)
            session.add(delivery)
            session.flush()
            quotation = Quotation(delivery_id=delivery.id)
            session.add(quotation)
            session.flush()
            revision_row = QuotationRevision(
                quotation_id=quotation.id,
                request_id=request.id,
                revision_number=1,
                status="draft",
                currency="LKR",
                total=10,
            )
            session.add(revision_row)
            session.flush()
            line = QuotationLineItem(
                revision_id=revision_row.id,
                position=1,
                kind="charge",
                description="Installation",
                quantity=1,
                unit_price=10,
                line_total=10,
            )
            session.add(line)
            session.commit()
            revision_row.sent_at = datetime.now(UTC)
            revision_row.valid_until = revision_row.sent_at + timedelta(days=1)
            revision_row.status = "sent"
            session.commit()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    revision_row.total = 999
                    session.flush()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    line.unit_price = 999
                    session.flush()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.delete(line)
                    session.flush()
            session.refresh(revision_row)
            session.refresh(line)
            assert revision_row.total == 10
            assert line.unit_price == 10
            revision_row.status = "accepted"
            session.commit()
            installation = Installation(accepted_revision_id=revision_row.id)
            session.add(installation)
            session.commit()
            session.refresh(installation)
            assert installation.accepted_revision_id == revision_row.id
            assert installation.created_at.utcoffset() is not None
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(Installation(accepted_revision_id=revision_row.id))
                    session.flush()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(Installation(accepted_revision_id=uuid4()))
                    session.flush()
            second_company = Company(name="Second migration quote company")
            second_request = QuotationRequest(
                customer_id=user_id,
                requirements={"district": "Colombo", "details": "Another request"},
            )
            session.add_all([second_company, second_request])
            session.flush()
            second_delivery = RequestDelivery(request_id=request.id, company_id=second_company.id)
            session.add(second_delivery)
            session.flush()
            second_quote = Quotation(delivery_id=second_delivery.id)
            session.add(second_quote)
            session.flush()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(
                        QuotationRevision(
                            quotation_id=second_quote.id,
                            request_id=second_request.id,
                            revision_number=1,
                            status="draft",
                            currency="LKR",
                        )
                    )
                    session.flush()
            competing = QuotationRevision(
                quotation_id=second_quote.id,
                request_id=request.id,
                revision_number=1,
                status="draft",
                currency="LKR",
            )
            session.add(competing)
            session.flush()
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    competing.status = "accepted"
                    session.flush()
            session.refresh(competing)
            assert competing.status == "draft"

        with Session(temporary_engine) as session:
            product = Product(kind="panel", brand="Fictional test brand", model="Test model")
            session.add(product)
            session.flush()
            panel = Panel(product_id=product.id, product_warranty_years=0)
            session.add(panel)
            session.commit()
            session.refresh(panel)
            assert panel.wattage_w is None
            assert panel.efficiency_percent is None
            assert panel.country_of_manufacture is None
            assert panel.product_warranty_years == 0
            assert panel.performance_warranty_years is None
            assert product.verified_at is None
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    panel.efficiency_percent = 101
                    session.flush()

        with Session(temporary_engine) as session:
            product = Product(kind="inverter", brand="Fictional test brand", model="Test inverter")
            session.add(product)
            session.flush()
            inverter = Inverter(product_id=product.id)
            session.add(inverter)
            session.commit()
            session.refresh(inverter)
            assert inverter.capacity_kw is None
            assert inverter.mppt_count is None
            assert inverter.compatibility_notes is None
            assert inverter.connectivity is None
            for field, value in (
                ("category", "unsupported"),
                ("capacity_kw", -1),
                ("mppt_count", -1),
                ("compatibility_notes", "Unsourced claim"),
            ):
                with pytest.raises(IntegrityError):
                    with session.begin_nested():
                        setattr(inverter, field, value)
                        session.flush()
            for category in ("on_grid", "off_grid", "hybrid"):
                inverter.category = category
                session.flush()
            inverter.compatibility_notes = "Fictional test compatibility statement"
            inverter.compatibility_source_url = "https://example.invalid/test-source"
            inverter.mppt_count = 0
            session.commit()
            session.refresh(inverter)
            assert inverter.mppt_count == 0
            assert inverter.compatibility_source_url is not None

        with Session(temporary_engine) as session:
            product = Product(kind="panel", brand="Test source brand", model="Test provenance")
            session.add(product)
            session.flush()
            retrieved = datetime(2026, 1, 1, tzinfo=UTC)
            source = ProductSource(
                product_id=product.id,
                source_url="https://example.invalid/datasheet",
                specifications={"wattage_w": "400.000"},
                retrieved_at=retrieved,
            )
            session.add(source)
            session.commit()
            session.refresh(source)
            assert source.verified_at is None
            assert source.retrieved_at == retrieved
            assert source.specifications == {"wattage_w": "400.000"}
            for field, value in (
                ("source_url", " "),
                ("specifications", {}),
                ("verified_at", retrieved - timedelta(days=1)),
            ):
                with pytest.raises(IntegrityError):
                    with session.begin_nested():
                        setattr(source, field, value)
                        session.flush()
            source.verified_at = retrieved + timedelta(days=1)
            session.commit()
            session.refresh(source)
            assert source.verified_at.utcoffset() is not None

        with Session(temporary_engine) as session:
            company = Company(name="Offer test company")
            product = Product(kind="panel", brand="Test brand", model="Test product")
            session.add_all([company, product])
            session.flush()
            offer = ProductOffer(
                company_id=company.id,
                product_id=product.id,
                company_claim="Company-declared installation support",
            )
            session.add(offer)
            session.commit()
            session.refresh(offer)
            assert offer.indicative_price is None
            assert offer.currency is None
            assert offer.claim_label == "company_declared"
            assert product.source_url is None
            offer.indicative_price = 0
            offer.currency = "LKR"
            offer.is_demo_price = True
            session.commit()
            assert offer.indicative_price == 0
            with pytest.raises(IntegrityError):
                with session.begin_nested():
                    session.add(ProductOffer(company_id=company.id, product_id=product.id))
                    session.flush()
            for field, value in (
                ("indicative_price", -1),
                ("currency", "USD"),
                ("claim_label", "verified"),
            ):
                with pytest.raises(IntegrityError):
                    with session.begin_nested():
                        setattr(offer, field, value)
                        if field == "currency":
                            offer.indicative_price = None
                        session.flush()
            session.refresh(product)
            assert product.model == "Test product"

        # Verify the revision was persisted, repeated upgrades are safe, and rollback works.
        with temporary_engine.begin() as connection:
            config.attributes["connection"] = connection
            assert sorted(inspect(connection).get_table_names()) == [
                "alembic_version",
                "app_users",
                "audit_events",
                "clerk_lifecycle_events",
                "companies",
                "company_memberships",
                "company_reviews",
                "estimator_config_versions",
                "favourites",
                "installations",
                "inverters",
                "media_assets",
                "panels",
                "product_offers",
                "product_sources",
                "products",
                "quotation_line_items",
                "quotation_requests",
                "quotation_revisions",
                "quotations",
                "request_deliveries",
                "request_delivery_notes",
                "saved_estimates",
            ]
            assert any(
                fk["referred_table"] == "request_deliveries"
                and fk["constrained_columns"] == ["delivery_id"]
                for fk in inspect(connection).get_foreign_keys("quotations")
            )
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            assert MigrationContext.configure(connection).get_current_revision() is None
            command.upgrade(config, "head")
            assert MigrationContext.configure(connection).get_current_revision() == (
                "0031_one_winner_per_request"
            )
    finally:
        if temporary_engine is not None:
            temporary_engine.dispose()
        try:
            if created:
                with admin_engine.connect().execution_options(
                    isolation_level="AUTOCOMMIT"
                ) as admin:
                    admin.execute(text(f'DROP DATABASE "{temporary_name}"'))
        finally:
            admin_engine.dispose()
