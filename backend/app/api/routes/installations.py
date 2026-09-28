"""Read installation milestones within customer or company scope."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.schemas.installations import InstallationProgress, MilestoneProgress
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser

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
    return InstallationProgress(
        id=installation.id,
        accepted_revision_id=installation.accepted_revision_id,
        created_at=installation.created_at,
        milestones=[
            MilestoneProgress(position=row.position, kind=row.kind, status=row.status)
            for row in rows
        ],
    )


def _installation_for_scope(
    session: Session,
    installation_id: UUID,
    *,
    customer_id: UUID | None = None,
    company_id: UUID | None = None,
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
    installation = session.scalars(statement).one_or_none()
    if installation is None:
        raise HTTPException(404)
    return installation


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
