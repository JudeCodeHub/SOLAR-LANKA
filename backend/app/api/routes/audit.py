"""Read-only audit API restricted by the platform audit permission."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.pagination import PaginationParams
from app.core.permissions import Action, Scope, required_scopes
from app.core.value_types import EntityId, Timestamp
from app.db.session import get_session
from app.models.audit import AuditEvent
from app.models.user import AppUser
from app.services.audit import AuditAction

router = APIRouter(prefix="/audit-events", tags=["audit"])


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: EntityId
    actor_id: EntityId
    company_id: EntityId | None
    target_id: EntityId
    action: AuditAction
    created_at: Timestamp


class AuditQuery(PaginationParams):
    company_id: UUID | None = None


def require_audit_reader(user: Annotated[AppUser, Depends(require_local_user)]) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.AUDIT_READ, user.role):
        raise HTTPException(403)
    return user


@router.get("", response_model=list[AuditEventResponse])
def read_audit_events(
    reader: Annotated[AppUser, Depends(require_audit_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[AuditQuery, Query()],
    response: Response,
) -> list[AuditEventResponse]:
    statement = select(AuditEvent)
    if pagination.company_id is not None:
        statement = statement.where(AuditEvent.company_id == pagination.company_id)
    entries = session.scalars(
        statement.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    response.headers["Cache-Control"] = "no-store"
    return [AuditEventResponse.model_validate(entry) for entry in entries]
