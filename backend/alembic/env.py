"""Alembic uses the same validated targets as application database connections."""

from alembic import context
from sqlalchemy import Connection
from sqlalchemy.engine import make_url

from app.core.database_config import DatabaseSettings, load_test_database_settings
from app.db.base import Base
from app.db.session import create_database_engine
from app.models.audit import AuditEvent  # noqa: F401
from app.models.company import Company, CompanyMembership, CompanyReview  # noqa: F401
from app.models.estimator_config import EstimatorConfigVersion  # noqa: F401
from app.models.favourite import Favourite  # noqa: F401
from app.models.installation import Installation  # noqa: F401
from app.models.installation_assignment import InstallationAssignment  # noqa: F401
from app.models.installation_internal_note import InstallationInternalNote  # noqa: F401
from app.models.installation_milestone import InstallationMilestoneRecord  # noqa: F401
from app.models.installation_milestone_event import InstallationMilestoneEvent  # noqa: F401
from app.models.inverter import Inverter  # noqa: F401
from app.models.lifecycle_event import LifecycleEvent  # noqa: F401
from app.models.media_asset import MediaAsset  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.outbox_event import OutboxEvent  # noqa: F401
from app.models.panel import Panel  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.product_offer import ProductOffer  # noqa: F401
from app.models.product_source import ProductSource  # noqa: F401
from app.models.quotation import Quotation, QuotationLineItem, QuotationRevision  # noqa: F401
from app.models.quotation_request import QuotationRequest, RequestDelivery  # noqa: F401
from app.models.request_delivery_note import RequestDeliveryNote  # noqa: F401
from app.models.saved_estimate import SavedEstimate  # noqa: F401
from app.models.site_visit import (  # noqa: F401
    SiteVisit,
    SiteVisitEvent,
    SiteVisitEvidence,
    SiteVisitNote,
    SiteVisitSlot,
)
from app.models.support_case import (  # noqa: F401
    SupportCase,
    SupportCaseAssignment,
    SupportCaseAttachment,
    SupportCaseUpdate,
)
from app.models.troubleshooting import TroubleshootingReference  # noqa: F401
from app.models.user import AppUser  # noqa: F401 -- register model metadata

config = context.config
target_metadata = Base.metadata


def load_settings() -> DatabaseSettings:
    target = context.get_x_argument(as_dictionary=True).get("environment")
    if target is None:
        return DatabaseSettings()
    if target == "test":
        return load_test_database_settings()
    raise ValueError("Only '-x environment=test' is supported; omit it for application settings")


def run_with_connection(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations() -> None:
    if context.is_offline_mode():
        settings = load_settings()
        url = make_url(settings.connection_url.get_secret_value()).set(
            drivername="postgresql+psycopg"
        )
        context.configure(
            url=url,
            target_metadata=target_metadata,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    # Tests may supply an already-authorised connection to their temporary database.
    connection = config.attributes.get("connection")
    if connection is not None:
        run_with_connection(connection)
        return

    engine = create_database_engine(load_settings())
    try:
        with engine.connect() as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


run_migrations()
