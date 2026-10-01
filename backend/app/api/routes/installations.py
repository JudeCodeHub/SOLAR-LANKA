"""Read installation milestones within customer or company scope."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.schemas.installations import (
    InstallationProgress,
    InstallationSummary,
    InternalNoteCreate,
    InternalNoteView,
    MilestoneEvidence,
    MilestoneHistory,
    MilestoneProgress,
    MilestoneScheduleUpdate,
    MilestoneTransition,
)
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.core.installation_milestones import (
    REQUIRED_EVIDENCE,
    InstallationMilestone,
    MilestoneStatus,
    can_transition,
)
from app.core.media_policy import AssetCategory, Visibility, policy_for
from app.core.permissions import Action, Scope, required_scopes
from app.core.private_storage import LocalPrivateStorage
from app.core.request_protection import UPLOAD_REQUEST, protect_user
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.installation import Installation
from app.models.installation_internal_note import InstallationInternalNote
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.installation_milestone_event import InstallationMilestoneEvent
from app.models.media_asset import MediaAsset
from app.models.outbox_event import OutboxEvent
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser


def _milestone_outbox(event: InstallationMilestoneEvent, installation_id: UUID) -> OutboxEvent:
    return OutboxEvent(
        event_key=f"installation.milestone_changed:{event.id}",
        event_type="installation.milestone_changed",
        aggregate_kind="installation",
        aggregate_id=installation_id,
        payload={
            "version": 1,
            "installation_id": str(installation_id),
            "milestone_id": str(event.milestone_id),
            "history_event_id": str(event.id),
        },
    )


customer_router = APIRouter(prefix="/users/me/installations", tags=["installations"])
company_router = APIRouter(prefix="/companies/{company_id}/installations", tags=["installations"])


def require_customer_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.INSTALLATION_READ, user.role):
        raise HTTPException(403)
    return user


def _progress(session: Session, installation: Installation) -> InstallationProgress:
    rows = session.scalars(
        select(InstallationMilestoneRecord)
        .where(InstallationMilestoneRecord.installation_id == installation.id)
        .order_by(InstallationMilestoneRecord.position)
    ).all()
    history = session.scalars(
        select(InstallationMilestoneEvent)
        .join(InstallationMilestoneRecord)
        .where(InstallationMilestoneRecord.installation_id == installation.id)
        .order_by(InstallationMilestoneEvent.created_at, InstallationMilestoneEvent.id)
    ).all()
    return InstallationProgress(
        id=installation.id,
        accepted_revision_id=installation.accepted_revision_id,
        created_at=installation.created_at,
        milestones=[
            MilestoneProgress(
                id=row.id,
                position=row.position,
                kind=row.kind,
                status=row.status,
                evidence=[MilestoneEvidence.model_validate(ref) for ref in row.evidence_refs],
            )
            for row in rows
        ],
        history=[MilestoneHistory.model_validate(event, from_attributes=True) for event in history],
    )


def _installation_for_scope(
    session: Session,
    installation_id: UUID,
    *,
    customer_id: UUID | None = None,
    company_id: UUID | None = None,
    lock: bool = False,
) -> Installation:
    statement = (
        select(Installation)
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .where(Installation.id == installation_id)
    )
    if customer_id is not None:
        statement = statement.where(QuotationRequest.customer_id == customer_id)
    if company_id is not None:
        statement = statement.where(RequestDelivery.company_id == company_id)
    if lock:
        statement = statement.with_for_update(of=Installation)
    installation = session.scalars(statement).one_or_none()
    if installation is None:
        raise HTTPException(404)
    return installation


def _installation_page(
    session: Session,
    pagination: PaginationParams,
    *,
    customer_id: UUID | None = None,
    company_id: UUID | None = None,
) -> PageResponse[InstallationSummary]:
    """Newest first, limited to the caller's own installations in the database query."""
    scope = (
        select(Installation.id)
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
    )
    if customer_id is not None:
        scope = scope.where(QuotationRequest.customer_id == customer_id)
    if company_id is not None:
        scope = scope.where(RequestDelivery.company_id == company_id)
    total = session.scalar(select(func.count()).select_from(scope.subquery())) or 0
    installations = session.scalars(
        select(Installation)
        .where(Installation.id.in_(scope))
        .order_by(Installation.created_at.desc(), Installation.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    totals = {
        installation_id: (completed, count)
        for installation_id, completed, count in session.execute(
            select(
                InstallationMilestoneRecord.installation_id,
                func.count().filter(InstallationMilestoneRecord.status == "completed"),
                func.count(),
            )
            .where(InstallationMilestoneRecord.installation_id.in_([i.id for i in installations]))
            .group_by(InstallationMilestoneRecord.installation_id)
        )
    }
    return PageResponse[InstallationSummary](
        items=[
            InstallationSummary(
                id=installation.id,
                accepted_revision_id=installation.accepted_revision_id,
                created_at=installation.created_at,
                completed_milestones=totals.get(installation.id, (0, 0))[0],
                total_milestones=totals.get(installation.id, (0, 0))[1],
            )
            for installation in installations
        ],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@customer_router.get("", response_model=PageResponse[InstallationSummary])
def list_customer_installations(
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[InstallationSummary]:
    response.headers["Cache-Control"] = "no-store"
    return _installation_page(session, pagination, customer_id=user.id)


@company_router.get("", response_model=PageResponse[InstallationSummary])
def list_company_installations(
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))
    ],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[InstallationSummary]:
    response.headers["Cache-Control"] = "no-store"
    return _installation_page(session, pagination, company_id=membership.company_id)


@customer_router.get("/{installation_id}", response_model=InstallationProgress)
def customer_installation_progress(
    installation_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> InstallationProgress:
    response.headers["Cache-Control"] = "no-store"
    return _progress(
        session, _installation_for_scope(session, installation_id, customer_id=user.id)
    )


@company_router.get("/{installation_id}", response_model=InstallationProgress)
def company_installation_progress(
    installation_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> InstallationProgress:
    response.headers["Cache-Control"] = "no-store"
    return _progress(
        session,
        _installation_for_scope(session, installation_id, company_id=membership.company_id),
    )


@company_router.put(
    "/{installation_id}/milestones/{milestone_id}", response_model=MilestoneProgress
)
def transition_milestone(
    installation_id: UUID,
    milestone_id: UUID,
    body: MilestoneTransition,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_UPDATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> MilestoneProgress:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id, lock=True)
    milestone = session.scalars(
        select(InstallationMilestoneRecord)
        .where(
            InstallationMilestoneRecord.id == milestone_id,
            InstallationMilestoneRecord.installation_id == installation_id,
        )
        .with_for_update()
    ).one_or_none()
    if milestone is None:
        raise HTTPException(404)

    predecessor_completed = (
        milestone.position == 1
        or session.scalar(
            select(InstallationMilestoneRecord.status).where(
                InstallationMilestoneRecord.installation_id == installation_id,
                InstallationMilestoneRecord.position == milestone.position - 1,
            )
        )
        == MilestoneStatus.COMPLETED.value
    )
    if body.evidence and body.status is not MilestoneStatus.COMPLETED:
        raise HTTPException(409, "Evidence can only be attached when completing a milestone.")
    evidence_kinds = {item.kind for item in body.evidence}
    asset_ids = {item.asset_id for item in body.evidence}
    if len(evidence_kinds) != len(body.evidence) or len(asset_ids) != len(body.evidence):
        raise HTTPException(409, "Duplicate milestone evidence.")
    if body.status is MilestoneStatus.COMPLETED:
        required = REQUIRED_EVIDENCE[InstallationMilestone(milestone.kind)]
        if evidence_kinds != required:
            raise HTTPException(409, "Required milestone evidence is missing or unsupported.")
        assets = session.scalars(
            select(MediaAsset).where(
                MediaAsset.id.in_(asset_ids),
                MediaAsset.parent_kind == "installation",
                MediaAsset.parent_id == installation_id,
                MediaAsset.category == "installation_evidence",
                MediaAsset.visibility == "private",
                MediaAsset.public_url.is_(None),
            )
        ).all()
        if len(assets) != len(asset_ids):
            raise HTTPException(409, "Milestone evidence does not belong to this installation.")
    if not can_transition(
        MilestoneStatus(milestone.status),
        body.status,
        milestone=InstallationMilestone(milestone.kind),
        predecessor_completed=predecessor_completed,
        verified_evidence=frozenset(evidence_kinds),
        reset_reason=body.reason,
    ):
        raise HTTPException(409, "Milestone transition is not allowed.")
    prior_status = milestone.status
    milestone.status = body.status.value
    if body.status is MilestoneStatus.COMPLETED:
        milestone.evidence_refs = [
            {"kind": item.kind, "asset_id": str(item.asset_id)} for item in body.evidence
        ]
    event = InstallationMilestoneEvent(
        milestone_id=milestone.id,
        actor_id=membership.user_id,
        from_status=prior_status,
        to_status=body.status.value,
        reason=body.reason,
        delay_until=body.delay_until,
        next_action=body.next_action,
    )
    session.add(event)
    session.flush()
    session.add(_milestone_outbox(event, installation_id))
    session.commit()
    return MilestoneProgress(
        id=milestone.id,
        position=milestone.position,
        kind=milestone.kind,
        status=milestone.status,
    )


@company_router.post(
    "/{installation_id}/milestones/{milestone_id}/updates", response_model=MilestoneHistory
)
def record_milestone_update(
    installation_id: UUID,
    milestone_id: UUID,
    body: MilestoneScheduleUpdate,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_UPDATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> MilestoneHistory:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id, lock=True)
    milestone = session.scalars(
        select(InstallationMilestoneRecord).where(
            InstallationMilestoneRecord.id == milestone_id,
            InstallationMilestoneRecord.installation_id == installation_id,
        )
    ).one_or_none()
    if milestone is None:
        raise HTTPException(404)
    if body.delay_until is None and not (body.next_action and body.next_action.strip()):
        raise HTTPException(422, "Specify a delay or next action.")
    event = InstallationMilestoneEvent(
        milestone_id=milestone.id,
        actor_id=membership.user_id,
        from_status=milestone.status,
        to_status=milestone.status,
        reason=body.reason.strip(),
        delay_until=body.delay_until,
        next_action=body.next_action,
    )
    session.add(event)
    session.flush()
    session.add(_milestone_outbox(event, installation_id))
    session.commit()
    return MilestoneHistory.model_validate(event, from_attributes=True)


@company_router.post(
    "/{installation_id}/internal-notes", response_model=InternalNoteView, status_code=201
)
def create_internal_note(
    installation_id: UUID,
    body: InternalNoteCreate,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_INTERNAL_NOTE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> InternalNoteView:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    note = InstallationInternalNote(
        installation_id=installation_id,
        actor_id=membership.user_id,
        body=body.body,
    )
    session.add(note)
    session.commit()
    return InternalNoteView.model_validate(note, from_attributes=True)


@company_router.get("/{installation_id}/internal-notes", response_model=list[InternalNoteView])
def list_internal_notes(
    installation_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_INTERNAL_NOTE))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> list[InternalNoteView]:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    notes = session.scalars(
        select(InstallationInternalNote)
        .where(InstallationInternalNote.installation_id == installation_id)
        .order_by(InstallationInternalNote.created_at.desc(), InstallationInternalNote.id.desc())
        .limit(limit)
    ).all()
    return [InternalNoteView.model_validate(note, from_attributes=True) for note in notes]


EVIDENCE = AssetCategory.INSTALLATION_EVIDENCE
_IMAGE_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
)


def _evidence_storage(request: Request) -> LocalPrivateStorage:
    try:
        return LocalPrivateStorage(environment=request.app.state.settings.environment)
    except RuntimeError:
        raise HTTPException(503, "Private storage is not configured") from None


def _image_type(content: bytes) -> tuple[str, str]:
    for signature, mime, extension in _IMAGE_SIGNATURES:
        if content.startswith(signature):
            return mime, extension
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp", "webp"
    raise HTTPException(404)


@company_router.post(
    "/{installation_id}/evidence",
    status_code=201,
    dependencies=[Depends(protect_user(UPLOAD_REQUEST))],
)
def upload_installation_evidence(
    installation_id: UUID,
    file: Annotated[UploadFile, File()],
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_UPDATE))
    ],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
    response: Response,
) -> dict[str, str]:
    """Store a private evidence image for this company's installation and return its reference."""
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    max_bytes = policy_for(EVIDENCE).max_bytes
    content = file.file.read(max_bytes + 1)
    try:
        file_id = storage.save(
            category=EVIDENCE, content=content, mime_type=file.content_type or ""
        )
    except ValueError:
        raise HTTPException(422, "Unsupported evidence file") from None
    asset = MediaAsset(
        provider="local_private",
        provider_file_id=file_id,
        owner_user_id=membership.user_id,
        category=EVIDENCE.value,
        parent_kind="installation",
        parent_id=installation_id,
        visibility=Visibility.PRIVATE.value,
    )
    session.add(asset)
    try:
        session.commit()
    except Exception:
        session.rollback()
        storage.delete(file_id)
        raise
    return {"id": str(asset.id)}


@company_router.get("/{installation_id}/evidence/{asset_id}")
def download_installation_evidence(
    installation_id: UUID,
    asset_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))
    ],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    """Return one evidence file only to staff of the company that owns the installation."""
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    asset = session.scalars(
        select(MediaAsset).where(
            MediaAsset.id == asset_id,
            MediaAsset.category == EVIDENCE.value,
            MediaAsset.parent_kind == "installation",
            MediaAsset.parent_id == installation_id,
            MediaAsset.visibility == Visibility.PRIVATE.value,
            MediaAsset.provider == "local_private",
            MediaAsset.public_url.is_(None),
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
            "Content-Disposition": f'attachment; filename="evidence.{extension}"',
        },
    )
