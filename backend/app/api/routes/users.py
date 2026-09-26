"""Authenticated users can read their own application profile."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.api.dependencies import require_local_user
from app.api.schemas.users import CurrentUserResponse
from app.models.user import AppUser

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(
    user: Annotated[AppUser, Depends(require_local_user)], response: Response
) -> CurrentUserResponse:
    response.headers["Cache-Control"] = "no-store"
    return CurrentUserResponse.model_validate(user)
