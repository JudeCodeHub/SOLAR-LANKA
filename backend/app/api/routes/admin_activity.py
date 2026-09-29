"""Platform-wide counts for the administration dashboard."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.audit import AuditEvent
from app.models.company import Company
from app.models.product import Product
from app.models.user import AppUser

router = APIRouter(prefix="/admin/activity", tags=["administration"])


class ActivitySummary(BaseModel):
    users: int
    approved_companies: int
    active_products: int
    audit_events: int


@router.get("", response_model=ActivitySummary)
def read_activity(
    user: Annotated[AppUser, Depends(require_local_user)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> ActivitySummary:
    if Scope.PLATFORM not in required_scopes(Action.PLATFORM_ACTIVITY_READ, user.role):
        raise HTTPException(403)
    response.headers["Cache-Control"] = "no-store"
    return ActivitySummary(
        users=session.scalar(select(func.count()).select_from(AppUser)) or 0,
        approved_companies=session.scalar(
            select(func.count())
            .select_from(Company)
            .where(Company.publication_status == "approved")
        )
        or 0,
        active_products=session.scalar(
            select(func.count()).select_from(Product).where(Product.is_archived.is_(False))
        )
        or 0,
        audit_events=session.scalar(select(func.count()).select_from(AuditEvent)) or 0,
    )
