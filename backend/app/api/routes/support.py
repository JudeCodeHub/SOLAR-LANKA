"""Support cases: a customer reports a problem; only their installing company reads it."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.routes.installations import (
    _evidence_storage,
    _image_type,
    _installation_for_scope,
    require_customer_reader,
)
from app.api.routes.site_visit_work import _installation_facts
from app.api.schemas.support import (
    AttachmentView,
    EquipmentView,
    SupportCaseCreate,
    SupportCaseView,
)
from app.core.media_policy import AssetCategory, Visibility, policy_for
from app.core.permissions import Action
from app.core.private_storage import LocalPrivateStorage
from app.core.request_protection import UPLOAD_REQUEST, protect_user
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.media_asset import MediaAsset
from app.models.product import Product
from app.models.support_case import SupportCase, SupportCaseAttachment
from app.models.user import AppUser

SUPPORT_EVIDENCE = AssetCategory.SUPPORT_EVIDENCE
MAX_ATTACHMENTS = 5
MAX_OPEN_CASES = 10
SAFETY_NOTICE = (
    "If you smell burning, see sparks, smoke or water, or feel unusual heat, do not touch the "
    "equipment. Switch off at the main isolator only if it is safe to reach, keep people away, "
    "and call a qualified technician or the emergency services."
)

customer_router = APIRouter(prefix="/users/me/support-cases", tags=["support"])
company_router = APIRouter(prefix="/companies/{company_id}/support-cases", tags=["support"])


def _view(session: Session, case: SupportCase) -> SupportCaseView:
    product = session.get(Product, case.product_id) if case.product_id else None
    attachments = session.scalars(
        select(SupportCaseAttachment)
        .where(SupportCaseAttachment.case_id == case.id)
        .order_by(SupportCaseAttachment.created_at, SupportCaseAttachment.id)
    ).all()
    return SupportCaseView(
        id=case.id,
        installation_id=case.installation_id,
        equipment=EquipmentView(
            id=product.id, kind=product.kind, brand=product.brand, model=product.model
        )
        if product
        else None,
        symptom=case.symptom,
        observed_code=case.observed_code,
        unsafe_now=case.unsafe_now,
        status=case.status,
        created_at=case.created_at,
        attachments=[
            AttachmentView(asset_id=a.asset_id, created_at=a.created_at) for a in attachments
        ],
        safety_notice=SAFETY_NOTICE if case.unsafe_now else None,
    )


def _owned(session: Session, user: AppUser, case_id: UUID, *, lock: bool = False) -> SupportCase:
    statement = select(SupportCase).where(
        SupportCase.id == case_id, SupportCase.customer_id == user.id
    )
    case = session.scalars(statement.with_for_update() if lock else statement).one_or_none()
    if case is None:
        raise HTTPException(404)
    return case


def _read_attachment(session: Session, case: SupportCase, asset_id: UUID, storage) -> Response:
    asset = session.scalars(
        select(MediaAsset)
        .join(SupportCaseAttachment, SupportCaseAttachment.asset_id == MediaAsset.id)
        .where(
            MediaAsset.id == asset_id,
            SupportCaseAttachment.case_id == case.id,
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
            "Content-Disposition": f'attachment; filename="support-photo.{extension}"',
        },
    )


# ---- the customer ----


@customer_router.get("", response_model=list[SupportCaseView])
def my_cases(
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[SupportCaseView]:
    response.headers["Cache-Control"] = "no-store"
    rows = session.scalars(
        select(SupportCase)
        .where(SupportCase.customer_id == user.id)
        .order_by(SupportCase.created_at.desc(), SupportCase.id)
        .limit(100)
    ).all()
    return [_view(session, row) for row in rows]


@customer_router.post("", response_model=SupportCaseView, status_code=201)
def open_case(
    body: SupportCaseCreate,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SupportCaseView:
    response.headers["Cache-Control"] = "no-store"
    # The installation must be the customer's own; its company is the only one the case goes to.
    installation = _installation_for_scope(
        session, body.installation_id, customer_id=user.id, lock=True
    )
    company_id, _ = _installation_facts(session, installation.id)
    if body.product_id is not None:
        product = session.get(Product, body.product_id)
        if product is None or product.is_archived:
            raise HTTPException(404)
    open_cases = session.scalar(
        select(func.count())
        .select_from(SupportCase)
        .where(SupportCase.customer_id == user.id, SupportCase.status.in_(("open", "in_progress")))
    )
    if (open_cases or 0) >= MAX_OPEN_CASES:
        raise BusinessConflict(f"You already have {MAX_OPEN_CASES} open support requests.")
    case = SupportCase(
        customer_id=user.id,
        company_id=company_id,
        installation_id=installation.id,
        product_id=body.product_id,
        symptom=body.symptom,
        observed_code=body.observed_code,
        unsafe_now=body.unsafe_now,
        status="open",
    )
    session.add(case)
    session.flush()
    view = _view(session, case)
    session.commit()
    return view


@customer_router.get("/{case_id}", response_model=SupportCaseView)
def my_case(
    case_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SupportCaseView:
    response.headers["Cache-Control"] = "no-store"
    return _view(session, _owned(session, user, case_id))


@customer_router.post(
    "/{case_id}/attachments",
    response_model=AttachmentView,
    status_code=201,
    dependencies=[Depends(protect_user(UPLOAD_REQUEST))],
)
def attach_photo(
    case_id: UUID,
    file: Annotated[UploadFile, File()],
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> AttachmentView:
    case = _owned(session, user, case_id, lock=True)
    if case.status in ("resolved", "closed"):
        raise BusinessConflict("This support request is finished, so photos cannot be added.")
    count = session.scalar(
        select(func.count())
        .select_from(SupportCaseAttachment)
        .where(SupportCaseAttachment.case_id == case.id)
    )
    if (count or 0) >= MAX_ATTACHMENTS:
        raise BusinessConflict(f"A support request can have at most {MAX_ATTACHMENTS} photos.")
    content = file.file.read(policy_for(SUPPORT_EVIDENCE).max_bytes + 1)
    try:
        file_id = storage.save(
            category=SUPPORT_EVIDENCE, content=content, mime_type=file.content_type or ""
        )
    except ValueError:
        raise HTTPException(422, "Unsupported photo") from None
    asset = MediaAsset(
        provider="local_private",
        provider_file_id=file_id,
        owner_user_id=user.id,
        category=SUPPORT_EVIDENCE.value,
        parent_kind="support_case",
        parent_id=case.id,
        visibility=Visibility.PRIVATE.value,
    )
    session.add(asset)
    session.flush()
    link = SupportCaseAttachment(case_id=case.id, asset_id=asset.id)
    session.add(link)
    try:
        session.flush()
        view = AttachmentView(asset_id=asset.id, created_at=link.created_at)
        session.commit()
    except Exception:
        session.rollback()
        storage.delete(file_id)
        raise
    return view


@customer_router.get("/{case_id}/attachments/{asset_id}")
def my_photo(
    case_id: UUID,
    asset_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    return _read_attachment(session, _owned(session, user, case_id), asset_id, storage)


# ---- the installing company ----

Staff = Annotated[CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))]


def _company_case(session: Session, membership: CompanyMembership, case_id: UUID) -> SupportCase:
    case = session.scalars(
        select(SupportCase).where(
            SupportCase.id == case_id, SupportCase.company_id == membership.company_id
        )
    ).one_or_none()
    if case is None:
        raise HTTPException(404)
    return case


@company_router.get("", response_model=list[SupportCaseView])
def company_cases(
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[SupportCaseView]:
    response.headers["Cache-Control"] = "no-store"
    rows = session.scalars(
        select(SupportCase)
        .where(SupportCase.company_id == membership.company_id)
        .order_by(SupportCase.unsafe_now.desc(), SupportCase.created_at.desc(), SupportCase.id)
        .limit(100)
    ).all()
    return [_view(session, row) for row in rows]


@company_router.get("/{case_id}", response_model=SupportCaseView)
def company_case(
    case_id: UUID,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SupportCaseView:
    response.headers["Cache-Control"] = "no-store"
    return _view(session, _company_case(session, membership, case_id))


@company_router.get("/{case_id}/attachments/{asset_id}")
def company_photo(
    case_id: UUID,
    asset_id: UUID,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    return _read_attachment(session, _company_case(session, membership, case_id), asset_id, storage)
