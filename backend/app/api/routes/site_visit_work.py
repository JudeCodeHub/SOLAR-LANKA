"""Doing a visit: the assigned technician completes it, adds notes and private photos."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.routes.installations import (
    EVIDENCE,
    _evidence_storage,
    _image_type,
    _installation_for_scope,
    require_customer_reader,
)
from app.api.routes.site_visits import _locked_visit, _record
from app.api.schemas.site_visit_work import (
    CompleteBody,
    EvidenceView,
    HistoryEntry,
    MyVisit,
    NoteBody,
    NoteView,
    VisitWork,
)
from app.core.media_policy import Visibility, policy_for
from app.core.permissions import Action
from app.core.private_storage import LocalPrivateStorage
from app.core.request_protection import UPLOAD_REQUEST, protect_user
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.installation import Installation
from app.models.media_asset import MediaAsset
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.site_visit import SiteVisit, SiteVisitEvent, SiteVisitEvidence, SiteVisitNote
from app.models.user import AppUser

MAX_EVIDENCE = 10

technician_router = APIRouter(prefix="/technician/site-visits", tags=["technician visits"])
company_router = APIRouter(
    prefix="/companies/{company_id}/installations/{installation_id}/site-visits/{visit_id}",
    tags=["site visits"],
)
customer_router = APIRouter(
    prefix="/users/me/installations/{installation_id}/site-visits/{visit_id}",
    tags=["site visits"],
)


def _installation_facts(session: Session, installation_id: UUID) -> tuple[UUID, str | None]:
    """The owning company and the district; nothing else about the customer's request."""
    company_id, requirements = session.execute(
        select(RequestDelivery.company_id, QuotationRequest.requirements)
        .select_from(Installation)
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(Installation.id == installation_id)
    ).one()
    district = requirements.get("district") if isinstance(requirements, dict) else None
    return company_id, district if isinstance(district, str) else None


def _is_active_technician(session: Session, user: AppUser, company_id: UUID) -> bool:
    return (
        session.scalar(
            select(CompanyMembership.id).where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.company_id == company_id,
                CompanyMembership.status == "active",
                CompanyMembership.role == "technician",
            )
        )
        is not None
    )


def _my_visit(session: Session, user: AppUser, visit_id: UUID) -> SiteVisit:
    """The visit this technician is booked for, while they still work for the company."""
    visit = session.scalars(
        select(SiteVisit).where(SiteVisit.id == visit_id, SiteVisit.technician_id == user.id)
    ).one_or_none()
    if visit is None or visit.status not in {"confirmed", "completed"}:
        raise HTTPException(404)
    company_id, _ = _installation_facts(session, visit.installation_id)
    if not _is_active_technician(session, user, company_id):
        raise HTTPException(404)
    return visit


def _work(session: Session, visit: SiteVisit, *, show_actors: bool) -> VisitWork:
    _, district = _installation_facts(session, visit.installation_id)
    notes = session.scalars(
        select(SiteVisitNote)
        .where(SiteVisitNote.visit_id == visit.id)
        .order_by(SiteVisitNote.created_at.desc(), SiteVisitNote.id)
    ).all()
    evidence = session.scalars(
        select(SiteVisitEvidence)
        .where(SiteVisitEvidence.visit_id == visit.id)
        .order_by(SiteVisitEvidence.created_at, SiteVisitEvidence.id)
    ).all()
    events = session.scalars(
        select(SiteVisitEvent)
        .where(SiteVisitEvent.visit_id == visit.id)
        .order_by(SiteVisitEvent.created_at, SiteVisitEvent.id)
    ).all()
    return VisitWork(
        id=visit.id,
        installation_id=visit.installation_id,
        district=district,
        status=visit.status,
        timezone=visit.timezone,
        customer_note=visit.note,
        confirmed_starts_at=visit.confirmed_starts_at,
        confirmed_ends_at=visit.confirmed_ends_at,
        completed_at=visit.completed_at,
        completed_by=visit.completed_by,
        completion_summary=visit.completion_summary,
        notes=[
            NoteView(id=n.id, actor_id=n.actor_id, body=n.body, created_at=n.created_at)
            for n in notes
        ],
        evidence=[
            EvidenceView(asset_id=e.asset_id, actor_id=e.actor_id, created_at=e.created_at)
            for e in evidence
        ],
        history=[
            HistoryEntry(
                action=e.action,
                from_status=e.from_status,
                to_status=e.to_status,
                reason=e.reason,
                created_at=e.created_at,
                # The customer's identity is never shown to the company's field staff.
                actor_id=e.actor_id if show_actors and e.actor_id != visit.requested_by else None,
            )
            for e in events
        ],
    )


def _complete(session: Session, visit: SiteVisit, actor: UUID, summary: str) -> None:
    if visit.status != "confirmed":
        raise BusinessConflict(
            f"This visit is {visit.status.replace('_', ' ')}, so it cannot be completed."
        )
    if visit.confirmed_starts_at is None or visit.confirmed_starts_at > datetime.now(UTC):
        raise BusinessConflict("The visit has not started yet, so it cannot be completed.")
    text = summary.strip()
    if not text:
        raise BusinessConflict("Say what was done: a completed visit needs a summary.")
    before = visit.status
    visit.status = "completed"
    visit.completed_at = datetime.now(UTC)
    visit.completed_by = actor
    visit.completion_summary = text
    _record(session, visit, actor, "completed", before, text)


def _add_note(session: Session, visit: SiteVisit, actor: UUID, body: str) -> NoteView:
    if visit.status not in {"confirmed", "completed"}:
        raise BusinessConflict("Notes can be added once a visit is confirmed.")
    text = body.strip()
    if not text:
        raise BusinessConflict("Write the note first.")
    note = SiteVisitNote(visit_id=visit.id, actor_id=actor, body=text)
    session.add(note)
    session.flush()
    return NoteView(id=note.id, actor_id=note.actor_id, body=note.body, created_at=note.created_at)


def _read_evidence(session: Session, visit: SiteVisit, asset_id: UUID, storage) -> Response:
    asset = session.scalars(
        select(MediaAsset)
        .join(SiteVisitEvidence, SiteVisitEvidence.asset_id == MediaAsset.id)
        .where(
            MediaAsset.id == asset_id,
            SiteVisitEvidence.visit_id == visit.id,
            MediaAsset.visibility == Visibility.PRIVATE.value,
            MediaAsset.provider == "local_private",
        )
    ).one_or_none()
    if asset is None:
        raise HTTPException(404)
    try:
        content = storage.read(asset.provider_file_id)
    except FileNotFoundError, ValueError:
        raise HTTPException(404) from None
    mime, extension = _image_type(content)
    return Response(
        content=content,
        media_type=mime,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="visit-photo.{extension}"',
        },
    )


# ---- the assigned technician ----


@technician_router.get("", response_model=list[MyVisit])
def my_visits(
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[MyVisit]:
    response.headers["Cache-Control"] = "no-store"
    visits = session.scalars(
        select(SiteVisit)
        .where(SiteVisit.technician_id == user.id, SiteVisit.status.in_(("confirmed", "completed")))
        .order_by(SiteVisit.confirmed_starts_at, SiteVisit.id)
    ).all()
    mine = []
    for visit in visits:
        company_id, district = _installation_facts(session, visit.installation_id)
        if _is_active_technician(session, user, company_id):
            mine.append(
                MyVisit(
                    id=visit.id,
                    installation_id=visit.installation_id,
                    district=district,
                    status=visit.status,
                    confirmed_starts_at=visit.confirmed_starts_at,
                    confirmed_ends_at=visit.confirmed_ends_at,
                )
            )
    return mine


@technician_router.get("/{visit_id}", response_model=VisitWork)
def my_visit(
    visit_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> VisitWork:
    response.headers["Cache-Control"] = "no-store"
    return _work(session, _my_visit(session, user, visit_id), show_actors=True)


@technician_router.post("/{visit_id}/complete", response_model=VisitWork)
def technician_complete(
    visit_id: UUID,
    body: CompleteBody,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> VisitWork:
    response.headers["Cache-Control"] = "no-store"
    visit = _my_visit(session, user, visit_id)
    visit = _locked_visit(session, visit.installation_id, visit.id)
    _complete(session, visit, user.id, body.summary)
    session.flush()
    view = _work(session, visit, show_actors=True)
    session.commit()
    return view


@technician_router.post("/{visit_id}/notes", response_model=NoteView, status_code=201)
def technician_note(
    visit_id: UUID,
    body: NoteBody,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
) -> NoteView:
    visit = _my_visit(session, user, visit_id)
    note = _add_note(session, visit, user.id, body.body)
    session.commit()
    return note


@technician_router.post(
    "/{visit_id}/evidence",
    status_code=201,
    dependencies=[Depends(protect_user(UPLOAD_REQUEST))],
)
def technician_upload(
    visit_id: UUID,
    file: Annotated[UploadFile, File()],
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> EvidenceView:
    visit = _my_visit(session, user, visit_id)
    count = len(
        session.scalars(
            select(SiteVisitEvidence.id).where(SiteVisitEvidence.visit_id == visit.id)
        ).all()
    )
    if count >= MAX_EVIDENCE:
        raise BusinessConflict(f"A visit can have at most {MAX_EVIDENCE} photos.")
    content = file.file.read(policy_for(EVIDENCE).max_bytes + 1)
    try:
        file_id = storage.save(
            category=EVIDENCE, content=content, mime_type=file.content_type or ""
        )
    except ValueError:
        raise HTTPException(422, "Unsupported evidence file") from None
    asset = MediaAsset(
        provider="local_private",
        provider_file_id=file_id,
        owner_user_id=user.id,
        category=EVIDENCE.value,
        parent_kind="installation",
        parent_id=visit.installation_id,
        visibility=Visibility.PRIVATE.value,
    )
    session.add(asset)
    session.flush()
    link = SiteVisitEvidence(visit_id=visit.id, asset_id=asset.id, actor_id=user.id)
    session.add(link)
    try:
        session.flush()
        view = EvidenceView(asset_id=asset.id, actor_id=user.id, created_at=link.created_at)
        session.commit()
    except Exception:
        session.rollback()
        storage.delete(file_id)
        raise
    return view


@technician_router.get("/{visit_id}/evidence/{asset_id}")
def technician_download(
    visit_id: UUID,
    asset_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    return _read_evidence(session, _my_visit(session, user, visit_id), asset_id, storage)


# ---- company staff ----

Reader = Annotated[CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))]
Updater = Annotated[
    CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
]


def _company_visit(session: Session, membership: CompanyMembership, installation_id, visit_id):
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    visit = _locked_visit(session, installation_id, visit_id)
    return visit


@company_router.get("/work", response_model=VisitWork)
def company_work(
    installation_id: UUID,
    visit_id: UUID,
    membership: Reader,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> VisitWork:
    response.headers["Cache-Control"] = "no-store"
    return _work(
        session, _company_visit(session, membership, installation_id, visit_id), show_actors=True
    )


@company_router.post("/complete", response_model=VisitWork)
def company_complete(
    installation_id: UUID,
    visit_id: UUID,
    body: CompleteBody,
    membership: Updater,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> VisitWork:
    response.headers["Cache-Control"] = "no-store"
    visit = _company_visit(session, membership, installation_id, visit_id)
    _complete(session, visit, membership.user_id, body.summary)
    session.flush()
    view = _work(session, visit, show_actors=True)
    session.commit()
    return view


@company_router.post("/notes", response_model=NoteView, status_code=201)
def company_note(
    installation_id: UUID,
    visit_id: UUID,
    body: NoteBody,
    membership: Updater,
    session: Annotated[Session, Depends(get_session)],
) -> NoteView:
    visit = _company_visit(session, membership, installation_id, visit_id)
    note = _add_note(session, visit, membership.user_id, body.body)
    session.commit()
    return note


@company_router.get("/evidence/{asset_id}")
def company_download(
    installation_id: UUID,
    visit_id: UUID,
    asset_id: UUID,
    membership: Reader,
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    visit = _company_visit(session, membership, installation_id, visit_id)
    return _read_evidence(session, visit, asset_id, storage)


# ---- the customer: the outcome and a history without names ----


@customer_router.get("/history", response_model=VisitWork)
def customer_history(
    installation_id: UUID,
    visit_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> VisitWork:
    """The visit's outcome and history. Working notes, photos and names stay with the company."""
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, customer_id=user.id)
    visit = _locked_visit(session, installation_id, visit_id)
    full = _work(session, visit, show_actors=False)
    return full.model_copy(update={"notes": [], "evidence": [], "completed_by": None})
