"""Shared dependencies for authenticated application routes."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.auth import VerifiedIdentity, require_identity
from app.db.session import get_session
from app.models.user import AppUser
from app.services.users import provision_user


def require_local_user(
    identity: Annotated[VerifiedIdentity, Depends(require_identity)],
    session: Annotated[Session, Depends(get_session)],
) -> AppUser:
    """Verify identity before provisioning; never accept a subject from request input."""
    user = provision_user(session, identity)
    session.commit()
    return user
