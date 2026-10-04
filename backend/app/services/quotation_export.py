"""Generate a private exported PDF once per export record, however often the job is retried."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.quotation_views import revision_view
from app.core.media_policy import AssetCategory
from app.core.private_storage import LocalPrivateStorage
from app.models.company import Company
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_export import QuotationExport
from app.models.quotation_request import RequestDelivery
from app.services.quotation_pdf import render_revision_pdf

EXPORT_EVENT = "quotation.export_requested"


def build_export(session: Session, export_id: UUID, storage: LocalPrivateStorage) -> bool:
    """Return True when this call produced the file; a replay finds it already there."""
    export = session.scalars(
        select(QuotationExport).where(QuotationExport.id == export_id).with_for_update()
    ).one_or_none()
    if export is None:
        raise ValueError("Export was not found")
    if export.file_id is not None:
        return False
    revision = session.get(QuotationRevision, export.revision_id)
    company_name = session.scalars(
        select(Company.name)
        .join(RequestDelivery, RequestDelivery.company_id == Company.id)
        .join(Quotation, Quotation.delivery_id == RequestDelivery.id)
        .where(Quotation.id == revision.quotation_id)
    ).one()
    content = render_revision_pdf(company_name, revision_view(session, revision))
    file_id = storage.save(
        category=AssetCategory.QUOTATION_DOCUMENT, content=content, mime_type="application/pdf"
    )
    try:
        export.file_id = file_id
        export.status = "ready"
        export.ready_at = datetime.now(UTC)
        session.commit()
    except BaseException:
        session.rollback()
        storage.delete(file_id)
        raise
    return True
