"""Customers request site visits with preferred slots; their company's staff read the requests."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.errors import BusinessConflict
from app.api.routes.installations import _installation_for_scope, require_customer_reader
from app.api.schemas.site_visits import SiteVisitCreate, SiteVisitView, SlotView
from app.core.permissions import Action
from app.core.site_visit_rules import Slot, SlotError, load_zone, validate_slots
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.site_visit import SiteVisit, SiteVisitSlot
from app.models.user import AppUser

customer_router = APIRouter(
    prefix="/users/me/installations/{installation_id}/site-visits", tags=["site visits"]
)
company_router = APIRouter(
    prefix="/companies/{company_id}/installations/{installation_id}/site-visits",
    tags=["site visits"],
)


def _view(session: Session, visit: SiteVisit) -> SiteVisitView:
    slots = session.scalars(
        select(SiteVisitSlot)
        .where(SiteVisitSlot.visit_id == visit.id)
        .order_by(SiteVisitSlot.position)
    ).all()
    return SiteVisitView(
        id=visit.id,
        installation_id=visit.installation_id,
        status=visit.status,
        timezone=visit.timezone,
        note=visit.note,
        created_at=visit.created_at,
        slots=[
            SlotView(position=s.position, starts_at=s.starts_at, ends_at=s.ends_at) for s in slots
        ],
    )


def _list(session: Session, installation_id: UUID) -> list[SiteVisitView]:
    visits = session.scalars(
        select(SiteVisit)
        .where(SiteVisit.installation_id == installation_id)
        .order_by(SiteVisit.created_at.desc(), SiteVisit.id)
    ).all()
    return [_view(session, visit) for visit in visits]


@customer_router.get("", response_model=list[SiteVisitView])
def my_site_visits(
    installation_id: UUID,
    user: Annotated[AppUser, Depends(require_customer_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[SiteVisitView]:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, customer_id=user.id)
    return _list(session, installation_id)


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
    try:
        load_zone(body.timezone)
        slots = validate_slots(
            [Slot(item.starts_at, item.ends_at) for item in body.slots],
            body.timezone,
            datetime.now(UTC),
        )
    except SlotError as error:
        raise BusinessConflict(str(error)) from error
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
    for number, slot in enumerate(slots, start=1):
        session.add(
            SiteVisitSlot(
                visit_id=visit.id, position=number, starts_at=slot.starts_at, ends_at=slot.ends_at
            )
        )
    session.flush()
    view = _view(session, visit)
    session.commit()
    return view


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
    return _list(session, installation_id)
