"""Assign technicians to installations, and give each technician only their assigned jobs."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.company_access import require_company_permission
from app.api.dependencies import require_local_user
from app.api.errors import BusinessConflict
from app.api.routes.installations import _installation_for_scope
from app.api.schemas.technician import (
    AssignedJob,
    AssignedJobSummary,
    AssignmentCreate,
    AssignmentView,
    JobStep,
)
from app.core.permissions import Action
from app.db.session import get_session
from app.models.company import CompanyMembership
from app.models.installation import Installation
from app.models.installation_assignment import InstallationAssignment
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.user import AppUser
from app.services.audit import AuditAction, record_audit

company_router = APIRouter(
    prefix="/companies/{company_id}/installations/{installation_id}/assignments",
    tags=["technician assignment"],
)
technician_router = APIRouter(prefix="/technician/installations", tags=["technician"])


def _eligible_technician(session: Session, company_id: UUID, user_id: UUID) -> AppUser:
    """Only an active technician of this company, with an active account, can be assigned."""
    user = session.get(AppUser, user_id)
    membership = session.scalars(
        select(CompanyMembership).where(
            CompanyMembership.user_id == user_id,
            CompanyMembership.company_id == company_id,
            CompanyMembership.status == "active",
            CompanyMembership.role == "technician",
        )
    ).one_or_none()
    if user is None or membership is None or user.is_suspended or user.provider_state != "active":
        raise BusinessConflict("Only an active technician of this company can be assigned.")
    return user


@company_router.get("", response_model=list[AssignmentView])
def list_assignments(
    installation_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[AssignmentView]:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id)
    rows = session.scalars(
        select(InstallationAssignment)
        .where(InstallationAssignment.installation_id == installation_id)
        .order_by(InstallationAssignment.created_at, InstallationAssignment.id)
    ).all()
    return [AssignmentView.model_validate(row) for row in rows]


@company_router.post("", response_model=AssignmentView, status_code=201)
def assign_technician(
    installation_id: UUID,
    body: AssignmentCreate,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
    ],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AssignmentView:
    response.headers["Cache-Control"] = "no-store"
    _installation_for_scope(session, installation_id, company_id=membership.company_id, lock=True)
    technician = _eligible_technician(session, membership.company_id, body.user_id)
    existing = session.scalar(
        select(InstallationAssignment.id).where(
            InstallationAssignment.installation_id == installation_id,
            InstallationAssignment.technician_id == technician.id,
        )
    )
    if existing is not None:
        raise BusinessConflict("This technician is already assigned to the installation.")
    row = InstallationAssignment(
        installation_id=installation_id, technician_id=technician.id, assigned_by=membership.user_id
    )
    session.add(row)
    record_audit(
        session,
        actor_id=membership.user_id,
        company_id=membership.company_id,
        target_id=installation_id,
        action=AuditAction.INSTALLATION_TECHNICIAN_ASSIGNED,
    )
    session.flush()
    view = AssignmentView.model_validate(row)
    session.commit()
    return view


@company_router.delete("/{technician_id}", status_code=204)
def unassign_technician(
    installation_id: UUID,
    technician_id: UUID,
    membership: Annotated[
        CompanyMembership, Depends(require_company_permission(Action.INSTALLATION_ASSIGN))
    ],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    _installation_for_scope(session, installation_id, company_id=membership.company_id, lock=True)
    row = session.scalars(
        select(InstallationAssignment).where(
            InstallationAssignment.installation_id == installation_id,
            InstallationAssignment.technician_id == technician_id,
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404)
    session.delete(row)
    record_audit(
        session,
        actor_id=membership.user_id,
        company_id=membership.company_id,
        target_id=installation_id,
        action=AuditAction.INSTALLATION_TECHNICIAN_UNASSIGNED,
    )
    session.commit()
    return Response(status_code=204)


def _assigned_rows(session: Session, user: AppUser, installation_id: UUID | None = None):
    """Installations assigned to this person where they still hold an active technician role."""
    statement = (
        select(Installation, RequestDelivery.company_id, QuotationRequest.requirements)
        .join(InstallationAssignment, InstallationAssignment.installation_id == Installation.id)
        .join(QuotationRevision, Installation.accepted_revision_id == QuotationRevision.id)
        .join(Quotation, QuotationRevision.quotation_id == Quotation.id)
        .join(RequestDelivery, Quotation.delivery_id == RequestDelivery.id)
        .join(QuotationRequest, RequestDelivery.request_id == QuotationRequest.id)
        .join(
            CompanyMembership,
            (CompanyMembership.company_id == RequestDelivery.company_id)
            & (CompanyMembership.user_id == user.id),
        )
        .where(
            InstallationAssignment.technician_id == user.id,
            CompanyMembership.status == "active",
            CompanyMembership.role == "technician",
        )
        .order_by(Installation.created_at.desc(), Installation.id)
    )
    if installation_id is not None:
        statement = statement.where(Installation.id == installation_id)
    return session.execute(statement).all()


def _steps(session: Session, installation_id: UUID) -> list[InstallationMilestoneRecord]:
    return list(
        session.scalars(
            select(InstallationMilestoneRecord)
            .where(InstallationMilestoneRecord.installation_id == installation_id)
            .order_by(InstallationMilestoneRecord.position)
        )
    )


def _district(requirements: dict) -> str | None:
    value = requirements.get("district") if isinstance(requirements, dict) else None
    return value if isinstance(value, str) else None


@technician_router.get("", response_model=list[AssignedJobSummary])
def my_assigned_jobs(
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[AssignedJobSummary]:
    response.headers["Cache-Control"] = "no-store"
    jobs = []
    for installation, company_id, requirements in _assigned_rows(session, user):
        steps = _steps(session, installation.id)
        jobs.append(
            AssignedJobSummary(
                id=installation.id,
                company_id=company_id,
                district=_district(requirements),
                created_at=installation.created_at,
                completed_steps=sum(1 for step in steps if step.status == "completed"),
                total_steps=len(steps),
            )
        )
    return jobs


@technician_router.get("/{installation_id}", response_model=AssignedJob)
def my_assigned_job(
    installation_id: UUID,
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> AssignedJob:
    response.headers["Cache-Control"] = "no-store"
    rows = _assigned_rows(session, user, installation_id)
    if not rows:
        # An unassigned job and a job that does not exist look the same.
        raise HTTPException(404)
    installation, company_id, requirements = rows[0]
    steps = _steps(session, installation.id)
    return AssignedJob(
        id=installation.id,
        company_id=company_id,
        district=_district(requirements),
        created_at=installation.created_at,
        completed_steps=sum(1 for step in steps if step.status == "completed"),
        total_steps=len(steps),
        steps=[JobStep(position=s.position, kind=s.kind, status=s.status) for s in steps],
    )
