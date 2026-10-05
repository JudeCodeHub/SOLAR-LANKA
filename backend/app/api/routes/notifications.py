"""Read and mark only the authenticated user's notifications."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, StrictBool
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.notifications import NotificationQuery, NotificationView
from app.api.schemas.pagination import PageResponse
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.notification import Notification
from app.models.notification_preference import NotificationPreference
from app.models.user import AppUser
from app.services.notification_preferences import preferences_for

router = APIRouter(prefix="/users/me/notifications", tags=["notifications"])


def require_notification_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.SELF not in required_scopes(Action.NOTIFICATION_READ, user.role):
        raise HTTPException(403)
    return user


def require_notification_marker(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.SELF not in required_scopes(Action.NOTIFICATION_MARK_READ, user.role):
        raise HTTPException(403)
    return user


def _owned_notification(
    session: Session, user: AppUser, notification_id: UUID, *, lock: bool = False
) -> Notification:
    query = select(Notification).where(
        Notification.id == notification_id,
        Notification.recipient_id == user.id,
    )
    if lock:
        query = query.with_for_update()
    notification = session.scalars(query).one_or_none()
    if notification is None:
        raise HTTPException(404)
    return notification


@router.get("", response_model=PageResponse[NotificationView])
def list_notifications(
    user: Annotated[AppUser, Depends(require_notification_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[NotificationQuery, Query()],
    response: Response,
) -> PageResponse[NotificationView]:
    response.headers["Cache-Control"] = "no-store"
    scope = [Notification.recipient_id == user.id]
    if pagination.unread_only:
        scope.append(Notification.read_at.is_(None))
    total = session.scalar(select(func.count()).select_from(Notification).where(*scope)) or 0
    rows = session.scalars(
        select(Notification)
        .where(*scope)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    ).all()
    return PageResponse[NotificationView](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[NotificationView.model_validate(row, from_attributes=True) for row in rows],
    )


@router.get("/{notification_id}", response_model=NotificationView)
def get_notification(
    notification_id: UUID,
    user: Annotated[AppUser, Depends(require_notification_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> NotificationView:
    response.headers["Cache-Control"] = "no-store"
    return NotificationView.model_validate(
        _owned_notification(session, user, notification_id), from_attributes=True
    )


@router.put("/{notification_id}/read", response_model=NotificationView)
def mark_notification_read(
    notification_id: UUID,
    user: Annotated[AppUser, Depends(require_notification_marker)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> NotificationView:
    response.headers["Cache-Control"] = "no-store"
    notification = _owned_notification(session, user, notification_id, lock=True)
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        session.commit()
    return NotificationView.model_validate(notification, from_attributes=True)


@router.put("/{notification_id}/unread", response_model=NotificationView)
def mark_notification_unread(
    notification_id: UUID,
    user: Annotated[AppUser, Depends(require_notification_marker)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> NotificationView:
    response.headers["Cache-Control"] = "no-store"
    notification = _owned_notification(session, user, notification_id, lock=True)
    if notification.read_at is not None:
        notification.read_at = None
        session.commit()
    return NotificationView.model_validate(notification, from_attributes=True)


class PreferencesView(BaseModel):
    reminders_enabled: bool
    email_enabled: bool


class PreferencesInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reminders_enabled: StrictBool
    email_enabled: StrictBool


preferences_router = APIRouter(prefix="/users/me/notification-preferences", tags=["notifications"])


@preferences_router.get("", response_model=PreferencesView)
def read_preferences(
    user: Annotated[AppUser, Depends(require_notification_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> PreferencesView:
    response.headers["Cache-Control"] = "no-store"
    reminders, email = preferences_for(session, user.id)
    return PreferencesView(reminders_enabled=reminders, email_enabled=email)


@preferences_router.put("", response_model=PreferencesView)
def save_preferences(
    body: PreferencesInput,
    user: Annotated[AppUser, Depends(require_notification_marker)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> PreferencesView:
    """Only the signed-in person's own row is ever written."""
    response.headers["Cache-Control"] = "no-store"
    values = {"reminders_enabled": body.reminders_enabled, "email_enabled": body.email_enabled}
    session.execute(
        insert(NotificationPreference)
        .values(user_id=user.id, **values)
        .on_conflict_do_update(
            index_elements=[NotificationPreference.user_id],
            set_={**values, "updated_at": func.now()},
        )
    )
    session.commit()
    return PreferencesView(**values)
