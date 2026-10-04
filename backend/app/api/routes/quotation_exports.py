"""Customer-requested quotation PDF exports, produced by the outbox job and delivered privately."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.routes.customer_quotations import owned_quotation, require_customer_quote_reader
from app.api.routes.installations import _evidence_storage
from app.core.private_storage import LocalPrivateStorage
from app.db.session import get_session
from app.models.outbox_event import OutboxEvent
from app.models.quotation import QuotationRevision
from app.models.quotation_export import QuotationExport
from app.models.user import AppUser
from app.services.quotation_export import EXPORT_EVENT
from app.services.quotation_pdf import pdf_headers

router = APIRouter(tags=["quotation exports"])


class ExportView(BaseModel):
    id: UUID
    revision_id: UUID
    status: Literal["pending", "ready"]


def owned_export(session: Session, export_id: UUID, user: AppUser) -> QuotationExport:
    export = session.scalars(
        select(QuotationExport).where(
            QuotationExport.id == export_id, QuotationExport.requester_id == user.id
        )
    ).one_or_none()
    if export is None:
        raise HTTPException(404)
    return export


@router.post(
    "/users/me/requests/{request_id}/quotations/{quotation_id}/revisions/{revision_id}/export",
    response_model=ExportView,
    status_code=202,
)
def request_export(
    request_id: UUID,
    quotation_id: UUID,
    revision_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> ExportView:
    response.headers["Cache-Control"] = "no-store"
    quotation = owned_quotation(session, request_id, quotation_id, user.id)
    revision = session.scalars(
        select(QuotationRevision).where(
            QuotationRevision.id == revision_id,
            QuotationRevision.quotation_id == quotation.id,
            QuotationRevision.sent_at.is_not(None),
        )
    ).one_or_none()
    if revision is None:
        raise HTTPException(404)
    session.execute(
        insert(QuotationExport)
        .values(revision_id=revision.id, requester_id=user.id)
        .on_conflict_do_nothing(constraint="uq_quotation_exports_revision_user")
    )
    export = session.scalars(
        select(QuotationExport).where(
            QuotationExport.revision_id == revision.id, QuotationExport.requester_id == user.id
        )
    ).one()
    if export.status == "pending":
        session.execute(
            insert(OutboxEvent)
            .values(
                event_key=f"{EXPORT_EVENT}:{export.id}",
                event_type=EXPORT_EVENT,
                aggregate_kind="quotation_export",
                aggregate_id=export.id,
                payload={"version": 1, "export_id": str(export.id)},
            )
            .on_conflict_do_nothing(index_elements=["event_key"])
        )
    session.commit()
    return ExportView(id=export.id, revision_id=export.revision_id, status=export.status)


@router.get("/users/me/exports/{export_id}", response_model=ExportView)
def export_status(
    export_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> ExportView:
    response.headers["Cache-Control"] = "no-store"
    export = owned_export(session, export_id, user)
    return ExportView(id=export.id, revision_id=export.revision_id, status=export.status)


@router.get("/users/me/exports/{export_id}/file")
def export_file(
    export_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_quote_reader)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    export = owned_export(session, export_id, user)
    if export.file_id is None:
        raise HTTPException(409, "The export is not ready yet")
    number = session.scalars(
        select(QuotationRevision.revision_number).where(QuotationRevision.id == export.revision_id)
    ).one()
    return Response(
        storage.read(export.file_id),
        media_type="application/pdf",
        headers=pdf_headers(number),
    )
