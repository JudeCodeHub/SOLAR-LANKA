"""Site visits: customers ask with preferred slots; company staff confirm or offer others."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.routes.installations import _installation_for_scope, require_customer_reader
from app.api.routes.technician import _eligible_technician
from app.api.schemas.site_visits import (
    Accept,
    Cancel,
    Confirm,
    Propose,
    Reschedule,
    SiteVisitCreate,
    SiteVisitView,
    SlotInput,
    SlotView,
)
from app.core.permissions import Action
from app.core.site_visit_rules import Slot, SlotError, load_zone, validate_slots
from app.core.site_visit_states import can
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.installation_assignment import InstallationAssignment
from app.models.site_visit import SiteVisit, SiteVisitEvent, SiteVisitSlot
from app.models.user import AppUser

customer_router = APIRouter(
    prefix="/users/me/installations/{installation_id}/site-visits", tags=["site visits"]
)
company_router = APIRouter(
    prefix="/companies/{company_id}/installations/{installation_id}/site-visits",
    tags=["site visits"],
)


def _view(session: Session, visit: SiteVisit, *, staff: bool) -> SiteVisitView:
    slots = session.scalars(
        select(SiteVisitSlot)
        .where(SiteVisitSlot.visit_id == visit.id)
        .order_by(SiteVisitSlot.kind, SiteVisitSlot.position)
    ).all()
    return SiteVisitView(
        id=visit.id,
        installation_id=visit.installation_id,
        status=visit.status,
        timezone=visit.timezone,
        note=visit.note,
        created_at=visit.created_at,
        confirmed_starts_at=visit.confirmed_starts_at,
        confirmed_ends_at=visit.confirmed_ends_at,
        technician_id=visit.technician_id if staff else None,
        slots=[
            SlotView(
                id=s.id, kind=s.kind, position=s.position, starts_at=s.starts_at, ends_at=s.ends_at
            )
            for s in slots
        ],
    )


def _list(session: Session, installation_id: UUID, *, staff: bool) -> list[SiteVisitView]:
    visits = session.scalars(
        select(SiteVisit)
        .where(SiteVisit.installation_id == installation_id)
        .order_by(SiteVisit.created_at.desc(), SiteVisit.id)
    ).all()
    return [_view(session, visit, staff=staff) for visit in visits]


def _checked(inputs: list[SlotInput], zone: str) -> list[Slot]:
    try:
        load_zone(zone)
        return validate_slots(
            [Slot(i.starts_at, i.ends_at) for i in inputs], zone, datetime.now(UTC)
        )
    except SlotError as error:
        raise BusinessConflict(str(error)) from error


def _add_slots(session: Session, visit: SiteVisit, kind: str, slots: list[Slot]) -> None:
    for number, slot in enumerate(slots, start=1):
        session.add(
            SiteVisitSlot(
                visit_id=visit.id,
                kind=kind,
                position=number,
                starts_at=slot.starts_at,
                ends_at=slot.ends_at,
            )
        )
    session.flush()


def _clear_slots(session: Session, visit: SiteVisit, kind: str) -> None:
    session.execute(
        delete(SiteVisitSlot).where(SiteVisitSlot.visit_id == visit.id, SiteVisitSlot.kind == kind)
    )
    session.flush()


def _record(
    session: Session, visit: SiteVisit, actor: UUID, action: str, before: str | None, reason=None
) -> None:
    session.add(
        SiteVisitEvent(
            visit_id=visit.id,
            actor_id=actor,
            action=action,
            from_status=before,
            to_status=visit.status,
            reason=reason,
        )
    )


def _flush_or_clash(session: Session, message: str) -> None:
    """Write the confirmation; the database refuses a technician double-booking, even in a race."""
    try:
        session.flush()
    except IntegrityError as error:
        session.rollback()
        if "ex_site_visits_technician_overlap" not in str(error.orig):
            raise
        raise BusinessConflict(message) from None


def _locked_visit(session: Session, installation_id: UUID, visit_id: UUID) -> SiteVisit:
    visit = session.scalars(
        select(SiteVisit)
        .where(SiteVisit.id == visit_id, SiteVisit.installation_id == installation_id)
        .with_for_update()
    ).one_or_none()
    if visit is None:
        raise HTTPException(404)
    return visit


def _require(action: str, visit: SiteVisit) -> None:
    if not can(action, visit.status):  # type: ignore[arg-type]
        raise BusinessConflict(
            f"This visit is {visit.status.replace('_', ' ')}, so that cannot be done."
        )


def _unconfirm(visit: SiteVisit) -> None:
    visit.technician_id = None
    visit.confirmed_starts_at = None
    visit.confirmed_ends_at = None


def _assign(session: Session, installation_id: UUID, technician: AppUser, by: UUID) -> None:
    """A confirmed visit also gives the technician sight of the job, if they lack it."""
    exists = session.scalar(
        select(InstallationAssignment.id).where(
            InstallationAssignment.installation_id == installation_id,
            InstallationAssignment.technician_id == technician.id,
        )
    )
    if exists is None:
        session.add(
            InstallationAssignment(
                installation_id=installation_id, technician_id=technician.id, assigned_by=by
            )
        )


# ---- customer ----


@customer_router.get("", response_model=list[SiteVisitView])
def my_site_visits(
    installation_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[SiteVisitView]:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, customer_id=user.id)
    return _list(session, installation_id, staff=False)


@customer_router.post("", response_model=SiteVisitView, status_code=201)
def request_site_visit(
    installation_id: UUID,
    body: SiteVisitCreate,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, customer_id=user.id, lock=True)
    slots = _checked(body.slots, body.timezone)
    note = body.note.strip() if body.note and body.note.strip() else None
    visit = SiteVisit(
        installation_id=installation_id, requested_by=user.id, timezone=body.timezone, note=note
    )
    session.add(visit)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise BusinessConflict("A site visit is already waiting for a response.") from None
    _add_slots(session, visit, "preferred", slots)
    _record(session, visit, user.id, "requested", None)
    session.flush()
    view = _view(session, visit, staff=False)
    session.commit()
    return view


def _customer_visit(session, user, installation_id, visit_id) -> SiteVisit:
    _installation_for_scope(session, installation_id, customer_id=user.id)
    return _locked_visit(session, installation_id, visit_id)


@customer_router.post("/{visit_id}/accept", response_model=SiteVisitView)
def accept_alternative(
    installation_id: UUID,
    visit_id: UUID,
    body: Accept,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _customer_visit(session, user, installation_id, visit_id)
    _require("accept", visit)
    slot = session.scalars(
        select(SiteVisitSlot).where(
            SiteVisitSlot.id == body.slot_id,
            SiteVisitSlot.visit_id == visit.id,
            SiteVisitSlot.kind == "proposed",
        )
    ).one_or_none()
    if slot is None:
        raise HTTPException(404)
    if slot.starts_at <= datetime.now(UTC):
        raise BusinessConflict("That slot has already started. Ask for new slots.")
    before = visit.status
    visit.status = "confirmed"
    visit.confirmed_starts_at, visit.confirmed_ends_at = slot.starts_at, slot.ends_at
    _record(session, visit, user.id, "accepted_alternative", before)
    _flush_or_clash(
        session, "That time is no longer available. Ask for new slots or wait for new offers."
    )
    view = _view(session, visit, staff=False)
    session.commit()
    return view


@customer_router.post("/{visit_id}/reschedule", response_model=SiteVisitView)
def customer_reschedule(
    installation_id: UUID,
    visit_id: UUID,
    body: Reschedule,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _customer_visit(session, user, installation_id, visit_id)
    _require("reschedule", visit)
    slots = _checked(body.slots, visit.timezone)
    before = visit.status
    _unconfirm(visit)
    _clear_slots(session, visit, "proposed")
    _clear_slots(session, visit, "preferred")
    _add_slots(session, visit, "preferred", slots)
    if body.note is not None:
        visit.note = body.note.strip() or None
    visit.status = "requested"
    _record(session, visit, user.id, "rescheduled_by_customer", before)
    session.flush()
    view = _view(session, visit, staff=False)
    session.commit()
    return view


@customer_router.post("/{visit_id}/cancel", response_model=SiteVisitView)
def customer_cancel(
    installation_id: UUID,
    visit_id: UUID,
    body: Cancel,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _customer_visit(session, user, installation_id, visit_id)
    return _cancel(session, visit, user.id, body, staff=False)


def _cancel(session: Session, visit: SiteVisit, actor: UUID, body: Cancel, *, staff: bool):
    _require("cancel", visit)
    before = visit.status
    visit.status = "cancelled"
    _record(session, visit, actor, "cancelled", before, (body.reason or "").strip() or None)
    session.flush()
    view = _view(session, visit, staff=staff)
    session.commit()
    return view


# ---- company staff ----

StaffMembership = Annotated[
    CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
]


@company_router.get("", response_model=list[SiteVisitView])
def company_site_visits(
    installation_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_READ))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[SiteVisitView]:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    return _list(session, installation_id, staff=True)


def _company_visit(session, membership, installation_id, visit_id) -> SiteVisit:
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    return _locked_visit(session, installation_id, visit_id)


@company_router.post("/{visit_id}/confirm", response_model=SiteVisitView)
def confirm_visit(
    installation_id: UUID,
    visit_id: UUID,
    body: Confirm,
    membership: StaffMembership,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _company_visit(session, membership, installation_id, visit_id)
    _require("confirm", visit)
    slot = session.scalars(
        select(SiteVisitSlot).where(
            SiteVisitSlot.id == body.slot_id,
            SiteVisitSlot.visit_id == visit.id,
            SiteVisitSlot.kind == "preferred",
        )
    ).one_or_none()
    if slot is None:
        raise HTTPException(404)
    if slot.starts_at <= datetime.now(UTC):
        raise BusinessConflict("That slot has already started. Offer other slots instead.")
    technician = _eligible_technician(session, membership.company_id, body.technician_id)
    before = visit.status
    visit.status = "confirmed"
    visit.technician_id = technician.id
    visit.confirmed_starts_at, visit.confirmed_ends_at = slot.starts_at, slot.ends_at
    _flush_or_clash(
        session, "That technician already has a confirmed visit at that time. Choose another."
    )
    _assign(session, installation_id, technician, membership.user_id)
    _record(session, visit, membership.user_id, "confirmed", before)
    session.flush()
    view = _view(session, visit, staff=True)
    session.commit()
    return view


@company_router.post("/{visit_id}/propose", response_model=SiteVisitView)
def propose_alternatives(
    installation_id: UUID,
    visit_id: UUID,
    body: Propose,
    membership: StaffMembership,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _company_visit(session, membership, installation_id, visit_id)
    _require("propose", visit)
    slots = _checked(body.slots, visit.timezone)
    technician = _eligible_technician(session, membership.company_id, body.technician_id)
    before = visit.status
    _unconfirm(visit)
    _clear_slots(session, visit, "proposed")
    _add_slots(session, visit, "proposed", slots)
    visit.status = "alternatives_offered"
    visit.technician_id = technician.id
    _record(session, visit, membership.user_id, "proposed_alternatives", before)
    session.flush()
    view = _view(session, visit, staff=True)
    session.commit()
    return view


@company_router.post("/{visit_id}/cancel", response_model=SiteVisitView)
def company_cancel(
    installation_id: UUID,
    visit_id: UUID,
    body: Cancel,
    membership: StaffMembership,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SiteVisitView:
    response.headers["Cache-Control"] = "no-store"
    visit = _company_visit(session, membership, installation_id, visit_id)
    return _cancel(session, visit, membership.user_id, body, staff=True)
