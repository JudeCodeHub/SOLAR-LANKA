"""Working a support case: assigned technicians, status changes and an ordered update history."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.routes.installations import _evidence_storage, require_customer_reader
from app.api.routes.support import (
    _company_case,
    _owned,
    _read_attachment,
    _view,
)
from app.api.routes.technician import _eligible_technician
from app.api.schemas.support import (
    AssignedCase,
    AssignedCaseSummary,
    AssignmentCreate,
    AttachmentView,
    EquipmentView,
    StatusChange,
    SupportCaseView,
    UpdateCreate,
    UpdateView,
)
from app.core.permissions import Action
from app.core.private_storage import LocalPrivateStorage
from app.core.support_states import can_move, needs_reason
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.support_case import (
    SupportCase,
    SupportCaseAssignment,
    SupportCaseAttachment,
    SupportCaseUpdate,
)
from app.models.user import AppUser

customer_router = APIRouter(prefix="/users/me/support-cases/{case_id}", tags=["support"])
company_router = APIRouter(
    prefix="/companies/{company_id}/support-cases/{case_id}", tags=["support"]
)
technician_router = APIRouter(prefix="/technician/support-cases", tags=["technician support"])

Key = Annotated[UUID | None, Header(alias="Idempotency-Key")]
Staff = Annotated[
    CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
]
Reader = Annotated[CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))]


def _update_view(row: SupportCaseUpdate, *, company_side: bool) -> UpdateView:
    return UpdateView(
        id=row.id,
        kind=row.kind,
        from_status=row.from_status,
        to_status=row.to_status,
        body=row.body,
        shared=row.shared,
        created_at=row.created_at,
        actor_role=row.actor_role if company_side else None,
        actor_id=row.actor_id if company_side and row.actor_role != "customer" else None,
        subject_id=row.subject_id if company_side else None,
    )


def _updates(session: Session, case: SupportCase, *, company_side: bool) -> list[UpdateView]:
    statement = (
        select(SupportCaseUpdate)
        .where(SupportCaseUpdate.case_id == case.id)
        .order_by(SupportCaseUpdate.created_at, SupportCaseUpdate.id)
    )
    if not company_side:
        statement = statement.where(SupportCaseUpdate.shared.is_(True))
    return [_update_view(row, company_side=company_side) for row in session.scalars(statement)]


def _previous(session: Session, case: SupportCase, actor: UUID, key: UUID | None):
    """The update a retried request already made, so a replay changes nothing."""
    if key is None:
        return None
    return session.scalars(
        select(SupportCaseUpdate).where(
            SupportCaseUpdate.case_id == case.id,
            SupportCaseUpdate.actor_id == actor,
            SupportCaseUpdate.idempotency_key == key,
        )
    ).one_or_none()


def _record(
    session: Session, case: SupportCase, actor: UUID, role: str, key: UUID | None, **fields
) -> SupportCaseUpdate:
    """Write the update and its outbox event together, so notifications follow exactly once."""
    row = SupportCaseUpdate(
        case_id=case.id, actor_id=actor, actor_role=role, idempotency_key=key, **fields
    )
    session.add(row)
    session.flush()
    session.add(
        OutboxEvent(
            event_key=f"support.case_updated:{row.id}",
            event_type="support.case_updated",
            aggregate_kind="support_case",
            aggregate_id=case.id,
            payload={"version": 1, "case_id": str(case.id), "update_id": str(row.id)},
        )
    )
    session.flush()
    return row


def _message(session, case, actor, role, key, text, shared):
    return _record(session, case, actor, role, key, kind="message", body=text, shared=shared)


def _guarded(session: Session, case: SupportCase, actor: UUID, key: UUID | None, write):
    """Run a write; a retry with the same key (even a simultaneous one) returns the first result."""
    earlier = _previous(session, case, actor, key)
    if earlier is not None:
        return earlier, False
    try:
        with session.begin_nested():
            return write(), True
    except IntegrityError:
        # A concurrent twin won the race for the same key.
        session.expire_all()
        winner = _previous(session, case, actor, key)
        if winner is None:
            raise
        return winner, False


def _locked(session: Session, case: SupportCase) -> SupportCase:
    return session.scalars(
        select(SupportCase).where(SupportCase.id == case.id).with_for_update()
    ).one()


def _change_status(
    session: Session, case: SupportCase, actor: UUID, role: str, body: StatusChange, key
):
    side = "staff" if role == "staff" else "customer"
    text = (body.body or "").strip() or None
    if not can_move(side, case.status, body.to):
        raise BusinessConflict(
            f"A support request that is {case.status.replace('_', ' ')} cannot move to "
            f"{body.to.replace('_', ' ')}."
        )
    if needs_reason(side, case.status, body.to) and not text:
        raise BusinessConflict("Say why the request is being closed without a resolution.")
    before = case.status
    case.status = body.to
    return _record(
        session, case, actor, role, key,
        kind="status", from_status=before, to_status=body.to, body=text, shared=True,
    )  # fmt: skip


# ---- the customer ----


@customer_router.get("/updates", response_model=list[UpdateView])
def customer_updates(
    case_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[UpdateView]:
    response.headers["Cache-Control"] = "no-store"
    return _updates(session, _owned(session, user, case_id), company_side=False)


@customer_router.post("/updates", response_model=UpdateView, status_code=201)
def customer_message(
    case_id: UUID,
    body: UpdateCreate,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> UpdateView:
    response.headers["Cache-Control"] = "no-store"
    case = _owned(session, user, case_id, lock=True)
    if case.status == "closed":
        raise BusinessConflict("This support request is closed.")
    row, created = _guarded(
        session, case, user.id, key,
        lambda: _message(session, case, user.id, "customer", key, body.body, True),
    )  # fmt: skip
    view = _update_view(row, company_side=False)
    session.commit()
    response.status_code = 201 if created else 200
    return view


@customer_router.post("/status", response_model=SupportCaseView)
def customer_status(
    case_id: UUID,
    body: StatusChange,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> SupportCaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _owned(session, user, case_id, lock=True)
    if _previous(session, case, user.id, key) is None:
        _guarded(
            session, case, user.id, key,
            lambda: _change_status(session, case, user.id, "customer", body, key),
        )  # fmt: skip
    view = _view(session, case)
    session.commit()
    return view


# ---- the installing company ----


@company_router.get("/updates", response_model=list[UpdateView])
def company_updates(
    case_id: UUID,
    membership: Reader,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[UpdateView]:
    response.headers["Cache-Control"] = "no-store"
    return _updates(session, _company_case(session, membership, case_id), company_side=True)


@company_router.post("/updates", response_model=UpdateView, status_code=201)
def company_update(
    case_id: UUID,
    body: UpdateCreate,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> UpdateView:
    response.headers["Cache-Control"] = "no-store"
    case = _locked(session, _company_case(session, membership, case_id))
    if case.status == "closed":
        raise BusinessConflict("This support request is closed.")
    row, created = _guarded(
        session, case, membership.user_id, key,
        lambda: _message(session, case, membership.user_id, "staff", key, body.body, body.shared),
    )  # fmt: skip
    view = _update_view(row, company_side=True)
    session.commit()
    response.status_code = 201 if created else 200
    return view


@company_router.post("/status", response_model=SupportCaseView)
def company_status(
    case_id: UUID,
    body: StatusChange,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> SupportCaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _locked(session, _company_case(session, membership, case_id))
    if _previous(session, case, membership.user_id, key) is None:
        _guarded(
            session, case, membership.user_id, key,
            lambda: _change_status(session, case, membership.user_id, "staff", body, key),
        )  # fmt: skip
    view = _view(session, case)
    session.commit()
    return view


@company_router.get("/assignments", response_model=list[UUID])
def company_assignments(
    case_id: UUID,
    membership: Reader,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[UUID]:
    response.headers["Cache-Control"] = "no-store"
    case = _company_case(session, membership, case_id)
    return list(
        session.scalars(
            select(SupportCaseAssignment.technician_id)
            .where(SupportCaseAssignment.case_id == case.id)
            .order_by(SupportCaseAssignment.created_at, SupportCaseAssignment.id)
        )
    )


@company_router.post("/assignments", response_model=UpdateView, status_code=201)
def assign(
    case_id: UUID,
    body: AssignmentCreate,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> UpdateView:
    response.headers["Cache-Control"] = "no-store"
    case = _locked(session, _company_case(session, membership, case_id))
    if case.status == "closed":
        raise BusinessConflict("This support request is closed.")
    earlier = _previous(session, case, membership.user_id, key)
    if earlier is not None:
        response.status_code = 200
        return _update_view(earlier, company_side=True)
    technician = _eligible_technician(session, membership.company_id, body.user_id)
    exists = session.scalar(
        select(SupportCaseAssignment.id).where(
            SupportCaseAssignment.case_id == case.id,
            SupportCaseAssignment.technician_id == technician.id,
        )
    )
    if exists is not None:
        raise BusinessConflict("This technician is already assigned to the support request.")
    session.add(
        SupportCaseAssignment(
            case_id=case.id, technician_id=technician.id, assigned_by=membership.user_id
        )
    )
    row = _record(
        session, case, membership.user_id, "staff", key,
        kind="assigned", subject_id=technician.id, shared=False,
    )  # fmt: skip
    view = _update_view(row, company_side=True)
    session.commit()
    return view


@company_router.delete("/assignments/{technician_id}", response_model=UpdateView)
def unassign(
    case_id: UUID,
    technician_id: UUID,
    membership: Staff,
    session: Annotated[Session, Depends(get_session)],
) -> UpdateView:
    case = _locked(session, _company_case(session, membership, case_id))
    row = session.scalars(
        select(SupportCaseAssignment).where(
            SupportCaseAssignment.case_id == case.id,
            SupportCaseAssignment.technician_id == technician_id,
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404)
    session.delete(row)
    update = _record(
        session, case, membership.user_id, "staff", None,
        kind="unassigned", subject_id=technician_id, shared=False,
    )  # fmt: skip
    view = _update_view(update, company_side=True)
    session.commit()
    return view


# ---- the assigned technician ----


def _assigned(session: Session, user: AppUser, case_id: UUID | None = None):
    """Cases assigned to this person while they still hold an active technician role there."""
    statement = (
        select(SupportCase)
        .join(SupportCaseAssignment, SupportCaseAssignment.case_id == SupportCase.id)
        .join(
            CompanyMembership,
            (CompanyMembership.company_id == SupportCase.company_id)
            & (CompanyMembership.user_id == user.id),
        )
        .where(
            SupportCaseAssignment.technician_id == user.id,
            CompanyMembership.status == "active",
            CompanyMembership.role == "technician",
        )
        .order_by(SupportCase.unsafe_now.desc(), SupportCase.created_at.desc(), SupportCase.id)
    )
    if case_id is not None:
        statement = statement.where(SupportCase.id == case_id)
    return list(session.scalars(statement))


def _assigned_one(session: Session, user: AppUser, case_id: UUID) -> SupportCase:
    found = _assigned(session, user, case_id)
    if not found:
        # An unassigned case and one that does not exist look the same.
        raise HTTPException(404)
    return found[0]


def _equipment(session: Session, case: SupportCase) -> EquipmentView | None:
    product = session.get(Product, case.product_id) if case.product_id else None
    if product is None:
        return None
    return EquipmentView(id=product.id, kind=product.kind, brand=product.brand, model=product.model)


@technician_router.get("", response_model=list[AssignedCaseSummary])
def my_cases(
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[AssignedCaseSummary]:
    response.headers["Cache-Control"] = "no-store"
    return [
        AssignedCaseSummary(
            id=c.id,
            equipment=_equipment(session, c),
            symptom=c.symptom,
            unsafe_now=c.unsafe_now,
            status=c.status,
            created_at=c.created_at,
        )
        for c in _assigned(session, user)
    ]


@technician_router.get("/{case_id}", response_model=AssignedCase)
def my_case(
    case_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AssignedCase:
    response.headers["Cache-Control"] = "no-store"
    case = _assigned_one(session, user, case_id)
    attachments = session.scalars(
        select(SupportCaseAttachment)
        .where(SupportCaseAttachment.case_id == case.id)
        .order_by(SupportCaseAttachment.created_at, SupportCaseAttachment.id)
    ).all()
    return AssignedCase(
        id=case.id,
        equipment=_equipment(session, case),
        symptom=case.symptom,
        unsafe_now=case.unsafe_now,
        status=case.status,
        created_at=case.created_at,
        observed_code=case.observed_code,
        attachments=[
            AttachmentView(asset_id=a.asset_id, created_at=a.created_at) for a in attachments
        ],
        updates=_updates(session, case, company_side=True),
    )


@technician_router.post("/{case_id}/updates", response_model=UpdateView, status_code=201)
def technician_update(
    case_id: UUID,
    body: UpdateCreate,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
    key: Key = None,
) -> UpdateView:
    response.headers["Cache-Control"] = "no-store"
    case = _locked(session, _assigned_one(session, user, case_id))
    if case.status == "closed":
        raise BusinessConflict("This support request is closed.")
    row, created = _guarded(
        session, case, user.id, key,
        lambda: _message(session, case, user.id, "technician", key, body.body, body.shared),
    )  # fmt: skip
    view = _update_view(row, company_side=True)
    session.commit()
    response.status_code = 201 if created else 200
    return view


@technician_router.get("/{case_id}/attachments/{asset_id}")
def technician_photo(
    case_id: UUID,
    asset_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[LocalPrivateStorage, Depends(_evidence_storage)],
) -> Response:
    return _read_attachment(session, _assigned_one(session, user, case_id), asset_id, storage)
